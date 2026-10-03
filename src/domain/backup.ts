import { normalizePhrasal, type PhrasalVerb } from './en/phrasal';
import type { SavedVerb } from './de/saved-verb';

/**
 * Sauvegarde complète du carnet, les deux langues.
 *
 * Les verbes allemands restent sous la clé `verbs`, comme dans les
 * sauvegardes de Verbheft : un ancien fichier se réimporte donc tel quel, et
 * un nouveau reste lisible par `parseImport` (src/domain/de/transfer.ts).
 */
export function toBackupJson(deVerbs: SavedVerb[], enPhrasals: PhrasalVerb[], now = new Date()): string {
  return JSON.stringify(
    { app: 'languages', version: 2, exportedAt: now.toISOString(), verbs: deVerbs, phrasals: enPhrasals },
    null,
    2,
  );
}

/** Expressions anglaises d'une sauvegarde JSON ; liste vide pour tout autre fichier. */
export function phrasalsFromBackup(text: string): PhrasalVerb[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return [];
  }
  const list = (data as { phrasals?: unknown } | null)?.phrasals;
  if (!Array.isArray(list)) return [];
  return list.map((item) => normalizePhrasal(item)).filter((p): p is PhrasalVerb => p !== null);
}
