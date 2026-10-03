/**
 * Accès générique à une collection synchronisée : lire, écrire, supprimer
 * en laissant une trace.
 */

import type { Syncable, SyncableCollection } from '../domain/sync';
import { db, TOMBSTONE_STORES } from './db';
import { emitChange } from './events';

export interface CollectionRepository<T extends Syncable> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  /** Écrit tel quel : c'est à l'appelant de poser `updatedAt`. */
  put(record: T): Promise<void>;
  putMany(records: T[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export function collectionRepository<T extends Syncable>(
  collection: SyncableCollection,
): CollectionRepository<T> {
  const tombstones = TOMBSTONE_STORES[collection];

  async function putMany(records: T[]): Promise<void> {
    if (records.length === 0) return;
    const database = await db();
    const tx = database.transaction([collection, tombstones], 'readwrite');
    for (const record of records) {
      void tx.objectStore(collection).put(record as never);
      // Un enregistrement recréé après sa suppression n'est plus supprimé.
      void tx.objectStore(tombstones).delete(record.id);
    }
    await tx.done;
    emitChange(collection, 'local');
  }

  return {
    async all() {
      return (await (await db()).getAll(collection)) as unknown as T[];
    },
    async get(id) {
      return (await (await db()).get(collection, id)) as unknown as T | undefined;
    },
    put: (record) => putMany([record]),
    putMany,
    async remove(id) {
      const database = await db();
      const tx = database.transaction([collection, tombstones], 'readwrite');
      void tx.objectStore(collection).delete(id);
      void tx.objectStore(tombstones).put({ id, deletedAt: new Date().toISOString() });
      await tx.done;
      emitChange(collection, 'local');
    },
  };
}
