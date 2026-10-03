import { normalizeExpression, type Expression } from './en/expression';
import { normalizePhrasal, type PhrasalVerb } from './en/phrasal';
import type { SavedVerb } from './de/saved-verb';

/**
 * Sauvegarde complète du carnet, les deux langues.
 *
 * Les verbes allemands restent sous la clé `verbs`, comme dans les
 * sauvegardes de Verbheft : un ancien fichier se réimporte donc tel quel, et
 * un nouveau reste lisible par `parseImport` (src/domain/de/transfer.ts).
 */
export function toBackupJson(
  deVerbs: SavedVerb[],
  enPhrasals: PhrasalVerb[],
  enExpressions: Expression[],
  now = new Date(),
): string {
  return JSON.stringify(
    {
      app: 'languages',
      version: 3,
      exportedAt: now.toISOString(),
      verbs: deVerbs,
      phrasals: enPhrasals,
      expressions: enExpressions,
    },
    null,
    2,
  );
}

/** Liste lue sous `key` dans une sauvegarde JSON ; vide pour tout autre fichier. */
function listFromBackup(text: string, key: string): unknown[] {
  try {
    const data: unknown = JSON.parse(text.replace(/^﻿/, ''));
    const list = (data as Record<string, unknown> | null)?.[key];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function phrasalsFromBackup(text: string): PhrasalVerb[] {
  return listFromBackup(text, 'phrasals')
    .map((item) => normalizePhrasal(item))
    .filter((p): p is PhrasalVerb => p !== null);
}

export function expressionsFromBackup(text: string): Expression[] {
  return listFromBackup(text, 'expressions')
    .map((item) => normalizeExpression(item))
    .filter((e): e is Expression => e !== null);
}
