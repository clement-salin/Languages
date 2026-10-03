/**
 * Produit `dist/sw.js` à la fin de la construction.
 *
 * Un service worker est un script que le navigateur garde même quand l'app
 * est fermée, et qui intercepte les requêtes : c'est lui qui permet d'ouvrir
 * l'app sans réseau. Il doit connaître la liste exacte des fichiers à mettre
 * en cache, or leurs noms portent une empreinte qui change à chaque
 * construction — d'où ce greffon, qui écrit la liste au dernier moment.
 *
 * Écrit à la main plutôt qu'avec `vite-plugin-pwa` : le projet n'a aucune
 * dépendance de ce type, et ce qu'il faut ici tient en quelques règles de
 * cache que l'on veut pouvoir lire et corriger soi-même. Repris de
 * batch-cooking, sans la partie photos.
 *
 * Le dictionnaire allemand (~5 Mo) fait partie des fichiers précachés :
 * c'est ce qui rend la conjugaison disponible hors ligne.
 */

import { createHash } from 'node:crypto';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

function listFiles(root: string, dir = root): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(root, full);
    return [`/${relative(root, full).split(sep).join('/')}`];
  });
}

/** Ni le service worker lui-même, ni les cartes de source. */
const EXCLUDED = /(^\/sw\.js$)|(\.map$)/;

function serviceWorkerSource(assets: string[], version: string): string {
  return `/* Généré par vite-plugins/service-worker.ts — ne pas modifier à la main. */
const VERSION = ${JSON.stringify(version)};
const SHELL = 'languages-shell-' + VERSION;
const ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener('install', (event) => {
  // Pas de skipWaiting ici : une nouvelle version ne remplace l'ancienne que
  // lorsque l'utilisateur l'accepte, pour ne pas recharger sous ses doigts.
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== SHELL).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Les échanges avec le serveur ne se mettent jamais en cache : une réponse
  // de synchronisation rejouée fausserait l'état des deux appareils.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Une navigation hors ligne doit rendre l'app, pas une page d'erreur.
  // L'app gère ensuite ses propres adresses, /de/<verbe> compris.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r ?? Response.error())),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
    return;
  }

});
`;
}

export function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir;
      // La construction du serveur passe aussi par ici : elle n'a pas de
      // service worker à produire.
      if (!dir || dir.endsWith('dist-server')) return;

      const assets = listFiles(dir).filter((file) => !EXCLUDED.test(file));
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
      writeFileSync(join(dir, 'sw.js'), serviceWorkerSource(assets, version));
      this.info?.(`sw.js écrit — ${assets.length} fichiers précachés`);
    },
  };
}
