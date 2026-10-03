import type { Auxiliary } from './auxiliary';
import type { ReflexiveCase } from './verb';

/**
 * Un verbe allemand enregistré dans le carnet.
 *
 * L'identifiant est l'infinitif lui-même (« sich freuen », « anrufen ») :
 * il est donc **déterministe**. Deux appareils qui ajoutent « fahren »
 * chacun de leur côté désignent le même enregistrement, et la
 * synchronisation n'en garde qu'un.
 */
export interface SavedVerb {
  id: string;
  translation: string;
  notes: string;
  /** Date d'ajout (ISO 8601). */
  addedAt: string;
  /** Dernière modification (ISO 8601) : c'est elle qui arbitre la synchronisation. */
  updatedAt: string;
  /** Choix de l'utilisateur quand le verbe admet plusieurs conjugaisons. */
  auxiliary?: Auxiliary;
  reflexiveCase?: ReflexiveCase;
  separable?: boolean;
}

/**
 * Valide un verbe lu depuis le stockage, un fichier importé ou le serveur.
 *
 * Les enregistrements de la première version (localStorage) n'ont pas
 * d'`updatedAt` : on reprend leur date d'ajout, la seule information sûre.
 */
export function normalizeSavedVerb(value: unknown, now = new Date().toISOString()): SavedVerb | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.trim() === '') return null;
  const isDate = (x: unknown): x is string => typeof x === 'string' && !Number.isNaN(Date.parse(x));
  const addedAt = isDate(v.addedAt) ? v.addedAt : now;
  return {
    id: v.id.trim(),
    translation: typeof v.translation === 'string' ? v.translation : '',
    notes: typeof v.notes === 'string' ? v.notes : '',
    addedAt,
    updatedAt: isDate(v.updatedAt) ? v.updatedAt : addedAt,
    ...(v.auxiliary === 'haben' || v.auxiliary === 'sein' ? { auxiliary: v.auxiliary } : {}),
    ...(v.reflexiveCase === 'acc' || v.reflexiveCase === 'dat' ? { reflexiveCase: v.reflexiveCase } : {}),
    ...(typeof v.separable === 'boolean' ? { separable: v.separable } : {}),
  };
}
