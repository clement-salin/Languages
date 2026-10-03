/**
 * Serveur de production : il sert les fichiers construits par `vite build`
 * et expose /api/sync. Repris de batch-cooking, sans l'import de recettes,
 * les photos ni la cantine.
 *
 * Aucune dépendance : uniquement les modules intégrés à Node. Rien à
 * installer sur le serveur en dehors de Node lui-même.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { defaultDatabaseFile, openSyncStore, type SyncStore } from './sync-store.ts';
import { parseTranslateRequest, translate, TRANSLATE_ROUTE } from './translate.ts';
import type { SyncRequest } from '../src/domain/sync.ts';

const PORT = Number(process.env['PORT'] ?? 8080);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const ROOT = resolve(process.env['STATIC_DIR'] ?? 'dist');

/*
 * La synchronisation est fermée par défaut : sans SYNC_TOKEN, l'endpoint
 * répond qu'il n'est pas configuré plutôt que d'exposer la base. Mieux vaut
 * une fonctionnalité éteinte qu'une porte ouverte que l'on croit fermée.
 */
const SYNC_TOKEN = process.env['SYNC_TOKEN'] ?? '';
const MAX_BODY = 8_000_000;

/** Clé DeepL, facultative : sans elle, seule la suggestion de traduction est éteinte. */
const DEEPL_API_KEY = process.env['DEEPL_API_KEY'] ?? '';

let store: SyncStore | undefined;
function syncStore(): SyncStore {
  store ??= openSyncStore(process.env['DATABASE_FILE'] ?? defaultDatabaseFile());
  return store;
}

/** Comparaison à durée constante : une égalité naïve fuit le jeton caractère par caractère. */
function tokenMatches(header: string | undefined): boolean {
  const given = Buffer.from((header ?? '').replace(/^Bearer /i, ''));
  const expected = Buffer.from(SYNC_TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('Corps de requête trop volumineux.');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/**
 * Résout un chemin demandé à l'intérieur de ROOT.
 *
 * `normalize` puis la vérification du préfixe empêchent qu'une requête du
 * type /../../etc/passwd sorte du dossier publié.
 */
function safePath(urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  } catch {
    return undefined;
  }
  const candidate = resolve(join(ROOT, normalize(decoded)));
  return candidate === ROOT || candidate.startsWith(ROOT + '/') ? candidate : undefined;
}

async function serveFile(res: ServerResponse, filePath: string, immutable: boolean): Promise<boolean> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'content-length': info.size,
      // Les fichiers produits par Vite portent une empreinte dans leur nom :
      // ils peuvent être mis en cache indéfiniment. index.html et sw.js,
      // jamais — sinon les mises à jour n'arriveraient plus.
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/api/sync') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }
    if (SYNC_TOKEN === '') {
      sendJson(res, 503, {
        error: "La synchronisation n'est pas configurée sur ce serveur (SYNC_TOKEN absent).",
      });
      return;
    }
    if (!tokenMatches(req.headers.authorization)) {
      sendJson(res, 401, { error: 'Jeton de synchronisation invalide.' });
      return;
    }

    let body: SyncRequest;
    try {
      body = (await readJson(req)) as SyncRequest;
    } catch {
      sendJson(res, 400, { error: 'Corps de requête illisible.' });
      return;
    }
    if (!body?.collections || typeof body.collections !== 'object') {
      sendJson(res, 400, { error: 'Corps de requête incomplet.' });
      return;
    }

    sendJson(res, 200, syncStore().exchange(body.since ?? null, body.collections));
    return;
  }

  /*
   * Traduction : réservée au porteur du jeton, comme la synchronisation.
   * Ouverte à tous, elle ferait de ce serveur un relais gratuit vers DeepL,
   * aux frais du quota de la clé.
   */
  if (url.pathname === TRANSLATE_ROUTE) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }
    if (SYNC_TOKEN === '') {
      sendJson(res, 503, { error: "Ce serveur n'est pas configuré (SYNC_TOKEN absent)." });
      return;
    }
    if (!tokenMatches(req.headers.authorization)) {
      sendJson(res, 401, { error: 'Jeton invalide.' });
      return;
    }
    let parsed;
    try {
      parsed = parseTranslateRequest(await readJson(req));
    } catch {
      parsed = 'Corps de requête illisible.';
    }
    if (typeof parsed === 'string') {
      sendJson(res, 400, { error: parsed });
      return;
    }
    const result = await translate(parsed, DEEPL_API_KEY);
    sendJson(res, result.status, result.body);
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Route inconnue.' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Méthode non autorisée.' });
    return;
  }

  const filePath = safePath(url.pathname);
  if (!filePath) {
    sendJson(res, 400, { error: 'Chemin invalide.' });
    return;
  }

  if (await serveFile(res, filePath, url.pathname.startsWith('/assets/'))) return;

  // L'app gère son propre routage : toute adresse inconnue rend index.html,
  // pour que /de/fahren fonctionne aussi en rechargeant la page.
  if (await serveFile(res, join(ROOT, 'index.html'), false)) return;

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Introuvable');
}

createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    console.error('[serveur]', error);
    if (!res.headersSent) sendJson(res, 500, { error: 'Erreur interne.' });
    else res.end();
  });
}).listen(PORT, HOST, () => {
  console.log(`Languages : http://${HOST}:${PORT} (fichiers servis depuis ${ROOT})`);
  if (SYNC_TOKEN === '') console.log('[sync] SYNC_TOKEN absent : synchronisation désactivée.');
  if (DEEPL_API_KEY === '') console.log('[traduction] DEEPL_API_KEY absent : suggestions de traduction désactivées.');
});
