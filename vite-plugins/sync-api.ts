/**
 * Expose /api/sync et /api/translate dans le serveur de développement de Vite.
 *
 * Même logique qu'en production (server/main.ts) : sans SYNC_TOKEN, les
 * routes répondent qu'elles ne sont pas configurées. Pour développer contre
 * une vraie synchronisation : `SYNC_TOKEN=un-secret npm run dev` ; pour la
 * traduction, ajouter `DEEPL_API_KEY=…`.
 */

import { timingSafeEqual } from 'node:crypto';
import type { Plugin } from 'vite';
import type { SyncRequest } from '../src/domain/sync.ts';
import type { SyncStore } from '../server/sync-store.ts';
import { parseTranslateRequest, translate, TRANSLATE_ROUTE } from '../server/translate.ts';

export const SYNC_ENDPOINT = '/api/sync';

export function syncApi(): Plugin {
  let store: SyncStore | undefined;

  return {
    name: 'sync-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(TRANSLATE_ROUTE, (req, res) => {
        const send = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        const token = process.env['SYNC_TOKEN'] ?? '';
        if (req.method !== 'POST') return send(405, { error: 'Méthode non autorisée.' });
        const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer /i, ''));
        const expected = Buffer.from(token);
        if (token === '' || given.length !== expected.length || !timingSafeEqual(given, expected)) {
          return send(401, { error: 'Jeton invalide.' });
        }
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          let parsed;
          try {
            parsed = parseTranslateRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            parsed = 'Corps de requête illisible.';
          }
          if (typeof parsed === 'string') return send(400, { error: parsed });
          void translate(parsed, process.env['DEEPL_API_KEY'] ?? '').then((result) => send(result.status, result.body));
        });
      });

      server.middlewares.use(SYNC_ENDPOINT, (req, res) => {
        const send = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };

        const token = process.env['SYNC_TOKEN'] ?? '';
        if (req.method !== 'POST') return send(405, { error: 'Méthode non autorisée.' });
        if (token === '') {
          return send(503, {
            error: "La synchronisation n'est pas configurée. Relance avec SYNC_TOKEN=… npm run dev.",
          });
        }

        const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer /i, ''));
        const expected = Buffer.from(token);
        if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
          return send(401, { error: 'Jeton de synchronisation invalide.' });
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          // Chargé à la demande : `node:sqlite` n'a rien à faire dans le
          // serveur de développement tant que personne ne synchronise.
          void import('../server/sync-store.ts')
            .then(({ defaultDatabaseFile, openSyncStore }) => {
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as SyncRequest;
              store ??= openSyncStore(process.env['DATABASE_FILE'] ?? defaultDatabaseFile());
              send(200, store.exchange(body.since ?? null, body.collections ?? {}));
            })
            .catch((error: unknown) => {
              server.config.logger.error(`[sync] ${(error as Error).message}`);
              send(400, { error: 'Échange impossible.' });
            });
        });
      });
    },
  };
}
