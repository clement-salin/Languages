/**
 * Reprise des verbes de Verbheft, première version de l'app, qui les
 * rangeait dans `localStorage` sous `verbheft:verbs`.
 *
 * Même domaine, donc même origine : le navigateur donne accès à cet ancien
 * stockage, et la reprise se fait toute seule au premier lancement.
 *
 * Trois précautions :
 * - **une seule fois** : une marque est posée dans la base. Rejouée, la
 *   reprise ferait revenir un verbe supprimé depuis ;
 * - **sans rien écraser** : un verbe déjà présent (arrivé par la
 *   synchronisation, par exemple) est conservé tel quel ;
 * - **l'ancienne copie n'est pas effacée**, seulement renommée en
 *   `verbheft:verbs.backup`, et seulement après relecture de la base.
 */

import { normalizeSavedVerb, type SavedVerb } from '../domain/de/saved-verb';
import { db, type MigrationMeta } from './db';
import { emitChange } from './events';

export const LEGACY_KEY = 'verbheft:verbs';
export const LEGACY_BACKUP_KEY = 'verbheft:verbs.backup';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Lit l'ancien format : `{ version: 1, verbs: [...] }`. */
export function parseLegacy(raw: string | null): SavedVerb[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { verbs?: unknown };
    if (!Array.isArray(data.verbs)) return [];
    return data.verbs.map((v) => normalizeSavedVerb(v)).filter((v): v is SavedVerb => v !== null);
  } catch {
    return [];
  }
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Nombre de verbes repris (0 si rien à faire). */
export async function migrateLegacyVerbs(storage: KeyValueStorage | null = browserStorage()): Promise<number> {
  if (!storage) return 0;
  const database = await db();
  if (await database.get('meta', 'legacy-migration')) return 0;

  let raw: string | null;
  try {
    raw = storage.getItem(LEGACY_KEY);
  } catch {
    return 0;
  }
  const legacy = parseLegacy(raw);

  const tx = database.transaction(['deVerbs', 'meta'], 'readwrite');
  const verbs = tx.objectStore('deVerbs');
  let added = 0;
  for (const verb of legacy) {
    if (await verbs.get(verb.id)) continue;
    await verbs.put(verb);
    added++;
  }
  const mark: MigrationMeta = { key: 'legacy-migration', at: new Date().toISOString(), count: added };
  await tx.objectStore('meta').put(mark);
  await tx.done;

  if (raw !== null) {
    const stored = new Set(await database.getAllKeys('deVerbs'));
    if (legacy.every((verb) => stored.has(verb.id))) {
      try {
        storage.setItem(LEGACY_BACKUP_KEY, raw);
        storage.removeItem(LEGACY_KEY);
      } catch {
        // Stockage plein ou refusé : l'ancienne copie reste en place, la
        // marque empêche de toute façon une seconde reprise.
      }
    }
  }
  if (added > 0) emitChange('deVerbs', 'local');
  return added;
}
