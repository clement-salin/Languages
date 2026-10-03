/** Dépôt des verbes allemands du carnet. */

import type { SavedVerb } from '../domain/de/saved-verb';
import { collectionRepository } from './collection';

export const deVerbs = collectionRepository<SavedVerb>('deVerbs');

type NewVerb = Pick<SavedVerb, 'id'> & Partial<Omit<SavedVerb, 'id' | 'updatedAt'>>;

/** Ajoute un verbe ; `false` s'il était déjà dans le carnet (rien n'est écrasé). */
export async function addVerb(verb: NewVerb): Promise<boolean> {
  if (await deVerbs.get(verb.id)) return false;
  const now = new Date().toISOString();
  await deVerbs.put({ translation: '', notes: '', addedAt: now, ...verb, updatedAt: now });
  return true;
}

export async function updateVerb(id: string, patch: Partial<Omit<SavedVerb, 'id' | 'addedAt'>>): Promise<void> {
  const current = await deVerbs.get(id);
  if (!current) return;
  const next: SavedVerb = { ...current, ...patch, updatedAt: new Date().toISOString() };
  // `undefined` efface un choix (auxiliaire revenu à sa valeur par défaut…) :
  // IndexedDB garderait sinon la clé avec une valeur vide.
  for (const key of Object.keys(next) as (keyof SavedVerb)[]) {
    if (next[key] === undefined) delete next[key];
  }
  await deVerbs.put(next);
}
