/**
 * Base locale (IndexedDB), via la bibliothèque `idb`.
 *
 * IndexedDB est la base de données intégrée au navigateur : contrairement à
 * `localStorage`, elle range des objets (pas une seule chaîne de texte) et
 * supporte des écritures groupées qui réussissent ou échouent ensemble.
 *
 * **Aucun écran n'importe ce fichier.** Les pages passent par les dépôts
 * (`de-verbs.ts`, `en-phrasals.ts`), qui sont seuls à connaître le stockage.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SavedVerb } from '../domain/de/saved-verb';
import type { PhrasalVerb } from '../domain/en/phrasal';
import type { SyncableCollection, Tombstone } from '../domain/sync';

/**
 * Chaque collection synchronisée a son magasin de traces de suppression :
 * sans elles, un enregistrement supprimé ici reviendrait au prochain
 * échange, renvoyé par l'autre appareil.
 */
export const TOMBSTONE_STORES = {
  deVerbs: 'deVerbTombstones',
  enPhrasals: 'enPhrasalTombstones',
} as const satisfies Record<SyncableCollection, string>;

export interface SyncMeta {
  key: 'sync';
  lastSyncAt: string | null;
  /** Collections connues de l'appareil à `lastSyncAt` (voir `requestSince`). */
  collections?: string[];
}

export interface MigrationMeta {
  key: 'legacy-migration';
  at: string;
  count: number;
}

interface LanguagesDB extends DBSchema {
  deVerbs: { key: string; value: SavedVerb };
  deVerbTombstones: { key: string; value: Tombstone };
  enPhrasals: { key: string; value: PhrasalVerb };
  enPhrasalTombstones: { key: string; value: Tombstone };
  meta: { key: string; value: SyncMeta | MigrationMeta };
}

export type Database = IDBPDatabase<LanguagesDB>;

const DB_VERSION = 1;
let dbName = 'languages';
let dbPromise: Promise<Database> | undefined;

export function db(): Promise<Database> {
  dbPromise ??= openDB<LanguagesDB>(dbName, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('deVerbs', { keyPath: 'id' });
        database.createObjectStore('deVerbTombstones', { keyPath: 'id' });
        database.createObjectStore('enPhrasals', { keyPath: 'id' });
        database.createObjectStore('enPhrasalTombstones', { keyPath: 'id' });
        database.createObjectStore('meta', { keyPath: 'key' });
      }
    },
  });
  return dbPromise;
}

/** Tests : repartir d'une base neuve, sous un autre nom. */
export async function useFreshDatabaseForTests(name: string): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = undefined;
  dbName = name;
}
