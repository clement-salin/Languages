/**
 * Ce que le moteur de synchronisation lit et écrit dans la base locale.
 * Repris de batch-cooking (`indexedDbSyncSource`).
 */

import {
  requestSince,
  SYNCABLE_COLLECTIONS,
  type MergeResult,
  type Syncable,
  type SyncableCollection,
  type Tombstone,
} from '../domain/sync';
import { db, TOMBSTONE_STORES, type SyncMeta } from './db';

export interface CollectionSnapshot {
  records: Syncable[];
  tombstones: Tombstone[];
}

export const syncSource = {
  async snapshot(): Promise<Record<SyncableCollection, CollectionSnapshot>> {
    const database = await db();
    const entries = await Promise.all(
      SYNCABLE_COLLECTIONS.map(async (collection) => {
        const [records, tombstones] = await Promise.all([
          database.getAll(collection),
          database.getAll(TOMBSTONE_STORES[collection]),
        ]);
        return [collection, { records: records as Syncable[], tombstones }] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<SyncableCollection, CollectionSnapshot>;
  },

  async lastSyncAt(): Promise<string | null> {
    const meta = (await (await db()).get('meta', 'sync')) as SyncMeta | undefined;
    return meta?.lastSyncAt ?? null;
  },

  /** Depuis quand demander au serveur : le dernier échange, ou tout si une collection est nouvelle ici. */
  async requestSince(): Promise<string | null> {
    const meta = (await (await db()).get('meta', 'sync')) as SyncMeta | undefined;
    return requestSince(meta?.lastSyncAt ?? null, meta?.collections);
  },

  /**
   * Applique le résultat d'un échange puis retient sa date.
   *
   * Ce qui vient du serveur est écrit **tel quel** : son `updatedAt` est
   * celui de l'appareil qui l'a modifié, et le réécrire ferait croire à une
   * modification locale au prochain échange — l'app repousserait
   * indéfiniment la même donnée.
   */
  async apply(merged: Record<SyncableCollection, MergeResult<Syncable>>, syncedAt: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(
      [
        'deVerbs',
        'enPhrasals',
        'enExpressions',
        'deVerbTombstones',
        'enPhrasalTombstones',
        'enExpressionTombstones',
        'meta',
      ],
      'readwrite',
    );
    for (const collection of SYNCABLE_COLLECTIONS) {
      const store = tx.objectStore(collection);
      for (const record of merged[collection].upserts) void store.put(record as never);
      for (const id of merged[collection].removals) void store.delete(id);

      // Les suppressions déjà transmises n'ont plus à être renvoyées.
      const tombstones = tx.objectStore(TOMBSTONE_STORES[collection]);
      for (const tombstone of await tombstones.getAll()) {
        if (tombstone.deletedAt <= syncedAt) void tombstones.delete(tombstone.id);
      }
    }
    const meta: SyncMeta = { key: 'sync', lastSyncAt: syncedAt, collections: [...SYNCABLE_COLLECTIONS] };
    void tx.objectStore('meta').put(meta);
    await tx.done;
  },
};
