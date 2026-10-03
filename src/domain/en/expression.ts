/**
 * Expressions anglaises : idiomes et tournures figées (*break the ice*,
 * *it's not my cup of tea*).
 *
 * Module pur : ni navigateur ni stockage.
 */

export interface Expression {
  /** L'expression normalisée (minuscules, espaces et apostrophes unifiés) : identique sur tous les appareils. */
  id: string;
  /** L'expression telle que saisie, pour l'affichage. */
  text: string;
  /** Sens en français, saisi par l'utilisateur. */
  meaning: string;
  /** Phrase d'exemple en anglais. */
  example: string;
  notes: string;
  addedAt: string;
  updatedAt: string;
}

/** « Break  the ice. » → « Break the ice » : ce qui est conservé pour l'affichage. */
export function cleanExpression(raw: string): string {
  return raw
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.;,]+$/g, '');
}

/** Identifiant : l'expression nettoyée, en minuscules. Vide si la saisie l'est. */
export function expressionId(raw: string): string {
  return cleanExpression(raw).toLowerCase();
}

/** Valide une expression lue depuis le stockage, un fichier ou le serveur. */
export function normalizeExpression(value: unknown, now = new Date().toISOString()): Expression | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const text = typeof v.text === 'string' ? cleanExpression(v.text) : '';
  if (!text) return null;
  const isDate = (x: unknown): x is string => typeof x === 'string' && !Number.isNaN(Date.parse(x));
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const addedAt = isDate(v.addedAt) ? v.addedAt : now;
  return {
    id: expressionId(text),
    text,
    meaning: str(v.meaning),
    example: str(v.example),
    notes: str(v.notes),
    addedAt,
    updatedAt: isDate(v.updatedAt) ? v.updatedAt : addedAt,
  };
}
