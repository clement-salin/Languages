/**
 * Expose /api/sync dans le serveur de développement de Vite.
 *
 * Même logique qu'en production (server/main.ts) : sans SYNC_TOKEN, la route
 * répond qu'elle n'est pas configurée. Pour développer contre une vraie
 * synchronisation : `SYNC_TOKEN=un-secret npm run dev`.
 */

import { timingSafeEqual } from 'node:crypto';
import type { Plugin } from 'vite';
import type { SyncRequest } from '../src/domain/sync.ts';
import type { SyncStore } from '../server/sync-store.ts';

export const SYNC_ENDPOINT = '/api/sync';

export function syncApi(): Plugin {
  let store: SyncStore | undefined;

  return {
    name: 'sync-api',
    apply: 'serve',
    configureServer(server) {
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
