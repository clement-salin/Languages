/**
 * Stockage serveur, en SQLite. Repris de batch-cooking, sans ce qui servait
 * à la cantine (données produites par le serveur) ni la reprise de son
 * premier schéma.
 *
 * SQLite est fourni par Node lui-même (`node:sqlite`) : aucune dépendance à
 * installer, aucun service à faire tourner. La base est un simple fichier,
 * que l'on sauvegarde en le copiant.
 *
 * Le serveur ne fait pas autorité sur les données : il n'est qu'un point de
 * rendez-vous entre appareils. Il ne comprend d'ailleurs **aucune** des
 * formes qu'il transporte — il stocke le JSON tel quel et ne lit que
 * l'identifiant et la date de modification. Ajouter un champ, ou même une
 * collection entière, ne demande donc aucune migration côté serveur.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  Collections,
  Syncable,
  SyncResponse,
  Tombstone,
} from '../src/domain/sync.ts';
import { acceptsIncoming, SYNCABLE_COLLECTIONS } from '../src/domain/sync.ts';

export interface SyncStore {
  exchange(since: string | null, incoming: Collections): SyncResponse;
  close(): void;
}

export function openSyncStore(file: string): SyncStore {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);

  // WAL : lectures et écritures ne se bloquent pas l'une l'autre.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS records_updated_at ON records (collection, updated_at);
    CREATE TABLE IF NOT EXISTS deletions (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS deletions_deleted_at ON deletions (collection, deleted_at);
  `);

  const readOne = db.prepare('SELECT updated_at FROM records WHERE collection = ? AND id = ?');
  const upsert = db.prepare(
    `INSERT INTO records (collection, id, payload, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(collection, id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  );
  const dropRecord = db.prepare('DELETE FROM records WHERE collection = ? AND id = ?');
  const readDeletion = db.prepare('SELECT deleted_at FROM deletions WHERE collection = ? AND id = ?');
  const recordDeletion = db.prepare(
    `INSERT INTO deletions (collection, id, deleted_at) VALUES (?, ?, ?)
     ON CONFLICT(collection, id) DO UPDATE SET deleted_at = excluded.deleted_at`,
  );
  const changedSince = db.prepare(
    'SELECT payload FROM records WHERE collection = ? AND updated_at > ?',
  );
  const allRecords = db.prepare('SELECT payload FROM records WHERE collection = ?');
  const deletedSince = db.prepare(
    'SELECT id, deleted_at FROM deletions WHERE collection = ? AND deleted_at > ?',
  );
  const allDeletions = db.prepare('SELECT id, deleted_at FROM deletions WHERE collection = ?');

  /*
   * Horloge strictement croissante.
   *
   * Un appareil ne reçoit que ce qui est postérieur (`>`) au `now` de son
   * dernier échange : deux échanges ne doivent donc jamais porter la même
   * date. Deux dates rendues par cette horloge ne sont jamais égales.
   */
  let last = '';
  const clock = (): string => {
    let now = new Date().toISOString();
    if (now <= last) now = new Date(Date.parse(last) + 1).toISOString();
    last = now;
    return now;
  };

  return {
    exchange(since, incoming) {
      const now = clock();

      db.exec('BEGIN');
      try {
        for (const collection of SYNCABLE_COLLECTIONS) {
          const payload = incoming[collection];
          if (!payload) continue;

          for (const record of payload.changes ?? []) {
            const stored = readOne.get(collection, record.id) as { updated_at: string } | undefined;
            if (!acceptsIncoming(stored && { updatedAt: stored.updated_at }, record)) continue;
            upsert.run(collection, record.id, JSON.stringify(record), record.updatedAt);
          }

          for (const tombstone of payload.deletions ?? []) {
            const known = readDeletion.get(collection, tombstone.id) as
              | { deleted_at: string }
              | undefined;
            if (known && known.deleted_at >= tombstone.deletedAt) continue;
            recordDeletion.run(collection, tombstone.id, tombstone.deletedAt);

            // L'enregistrement ne disparaît que si la suppression est
            // postérieure à la version détenue : une modification faite après
            // la suppression sur un autre appareil doit survivre.
            const stored = readOne.get(collection, tombstone.id) as
              | { updated_at: string }
              | undefined;
            if (stored && tombstone.deletedAt > stored.updated_at) {
              dropRecord.run(collection, tombstone.id);
            }
          }
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      const collections: Collections = {};
      for (const collection of SYNCABLE_COLLECTIONS) {
        const rows = (
          since === null ? allRecords.all(collection) : changedSince.all(collection, since)
        ) as { payload: string }[];
        const gone = (
          since === null ? allDeletions.all(collection) : deletedSince.all(collection, since)
        ) as { id: string; deleted_at: string }[];

        collections[collection] = {
          changes: rows.map((row) => JSON.parse(row.payload) as Syncable),
          deletions: gone.map((row): Tombstone => ({ id: row.id, deletedAt: row.deleted_at })),
        };
      }

      return { now, collections };
    },

    close() {
      db.close();
    },
  };
}

export function defaultDatabaseFile(): string {
  return join(process.env['DATA_DIR'] ?? 'data', 'languages.db');
}
