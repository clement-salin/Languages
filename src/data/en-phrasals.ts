/** Dépôt des phrasal verbs anglais. */

import { phrasalId, type PhrasalVerb } from '../domain/en/phrasal';
import { collectionRepository } from './collection';

export const enPhrasals = collectionRepository<PhrasalVerb>('enPhrasals');

export interface NewPhrasal {
  base: string;
  particle: string;
  meaning: string;
  example?: string;
  notes?: string;
}

/** Ajoute une expression ; `false` si elle existe déjà (rien n'est écrasé). */
export async function addPhrasal(input: NewPhrasal): Promise<boolean> {
  const id = phrasalId(input.base, input.particle);
  if (await enPhrasals.get(id)) return false;
  const now = new Date().toISOString();
  await enPhrasals.put({
    id,
    base: input.base,
    particle: input.particle,
    meaning: input.meaning,
    example: input.example ?? '',
    notes: input.notes ?? '',
    addedAt: now,
    updatedAt: now,
  });
  return true;
}

/** Le verbe et la particule ne changent pas : ils font l'identifiant. */
export async function updatePhrasal(
  id: string,
  patch: Partial<Pick<PhrasalVerb, 'meaning' | 'example' | 'notes'>>,
): Promise<void> {
  const current = await enPhrasals.get(id);
  if (!current) return;
  await enPhrasals.put({ ...current, ...patch, updatedAt: new Date().toISOString() });
}
