import { normalizeSavedVerb, type SavedVerb } from './storage';

/** Sauvegarde complète du carnet (réimportable). */
export function toJson(verbs: SavedVerb[]): string {
  return JSON.stringify(
    { app: 'verbheft', version: 1, exportedAt: new Date().toISOString(), verbs },
    null,
    2,
  );
}

export interface CsvRow {
  verb: SavedVerb;
  principalParts: string;
  verbClass: string;
  auxiliary: string;
}

/** Export tableur (séparateur « ; » pour Excel en français, BOM pour les accents). */
export function toCsv(rows: CsvRow[]): string {
  const header = ['infinitif', 'traduction', 'formes principales', 'type', 'auxiliaire', 'ajouté le', 'notes'];
  const lines = rows.map(({ verb, principalParts, verbClass, auxiliary }) =>
    [verb.id, verb.translation, principalParts, verbClass, auxiliary, verb.addedAt.slice(0, 10), verb.notes]
      .map(csvCell)
      .join(';'),
  );
  return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n';
}

function csvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Entrée lue dans un fichier importé, avant vérification dans le dictionnaire. */
export interface ImportedEntry {
  input: string;
  translation: string;
  saved?: SavedVerb;
}

/**
 * Lit un fichier importé :
 * - une sauvegarde JSON de l'application (ou une liste JSON d'infinitifs) ;
 * - un CSV / texte : une ligne par verbe, « verbe ; traduction » (séparateur
 *   « ; », « , » ou tabulation), avec ou sans ligne d'en-tête.
 */
export function parseImport(text: string): ImportedEntry[] {
  const content = text.replace(/^﻿/, '').trim();
  if (content.startsWith('{') || content.startsWith('[')) return parseJson(content);
  return parseDelimited(content);
}

function parseJson(content: string): ImportedEntry[] {
  const data: unknown = JSON.parse(content);
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { verbs?: unknown }).verbs)
      ? (data as { verbs: unknown[] }).verbs
      : [];
  const out: ImportedEntry[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ input: item.trim(), translation: '' });
      continue;
    }
    const saved = normalizeSavedVerb(item);
    if (saved) out.push({ input: saved.id, translation: saved.translation, saved });
  }
  return out;
}

function parseDelimited(content: string): ImportedEntry[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const delimiter = [';', '\t', ','].find((d) => lines[0].includes(d)) ?? ';';
  const rows = lines.map((line) => splitCsvLine(line, delimiter));
  if (/^(infinitif|verbe?|infinitiv|verb)$/i.test(rows[0][0]?.trim() ?? '')) rows.shift();
  return rows
    .map((cells) => ({ input: (cells[0] ?? '').trim(), translation: (cells[1] ?? '').trim() }))
    .filter((e) => e.input !== '');
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}
