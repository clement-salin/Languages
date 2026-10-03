/**
 * Phrasal verbs : un verbe de base suivi d'une ou plusieurs particules
 * (*sit down*, *sit in on*, *get over*).
 *
 * Module pur : ni navigateur ni stockage.
 */

/** Une expression enregistrée dans le carnet. */
export interface PhrasalVerb {
  /** « sit down » : dérivé de l'expression, donc identique sur tous les appareils. */
  id: string;
  /** Verbe de base, en minuscules (« sit »). */
  base: string;
  /** Tout ce qui suit le verbe, tel que saisi (« in on », « sth up »). */
  particle: string;
  /** Sens en français, saisi par l'utilisateur : l'app n'en invente aucun. */
  meaning: string;
  /** Phrase d'exemple en anglais. */
  example: string;
  notes: string;
  addedAt: string;
  updatedAt: string;
}

/**
 * Mots qui tiennent la place d'un complément (« give sth up ») : gardés dans
 * l'expression, ignorés pour regrouper par particule.
 */
const PLACEHOLDERS = new Set([
  'sth', 'sb', 'smth', 'smb', 'something', 'someone', 'somebody', 'one', "one's", 'oneself',
]);

/**
 * « To Sit  Down » → { base: 'sit', particle: 'down' }.
 * `null` s'il n'y a pas au moins un verbe et une particule.
 */
export function parsePhrasal(raw: string): { base: string; particle: string } | null {
  const words = raw
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[.!?;,]+$/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words[0] === 'to') words.shift();
  if (words.length < 2) return null;
  const [base, ...rest] = words;
  if (!/^[a-z][a-z'-]*$/.test(base!)) return null;
  return { base: base!, particle: rest.join(' ') };
}

export function phrasalId(base: string, particle: string): string {
  return `${base} ${particle}`;
}

/**
 * Ce qu'on donne à traduire : « to sit up » plutôt que « sit up ».
 * L'infinitif oriente la traduction vers le verbe, et non vers un ordre
 * (« assieds-toi ! ») ou un nom.
 */
export function translatable(phrasal: { base: string; particle: string }): string {
  return `to ${phrasal.base} ${phrasal.particle}`;
}

/** Particule sans les mots de remplissage : « sth up » → « up ». */
export function particleKey(particle: string): string {
  const words = particle.split(' ').filter((w) => !PLACEHOLDERS.has(w.replace(/[()]/g, '')));
  return words.length > 0 ? words.join(' ') : particle;
}

export interface PhrasalGroup {
  key: string;
  items: PhrasalVerb[];
}

export type GroupMode = 'verb' | 'particle';

/** Regroupe par verbe de base ou par particule, dans l'ordre alphabétique. */
export function groupPhrasals(list: PhrasalVerb[], mode: GroupMode): PhrasalGroup[] {
  const groups = new Map<string, PhrasalVerb[]>();
  for (const item of list) {
    const key = mode === 'verb' ? item.base : particleKey(item.particle);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  const inner = mode === 'verb'
    ? (a: PhrasalVerb, b: PhrasalVerb) => a.particle.localeCompare(b.particle, 'en')
    : (a: PhrasalVerb, b: PhrasalVerb) => a.base.localeCompare(b.base, 'en');
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([key, items]) => ({ key, items: [...items].sort(inner) }));
}

/** Valide une expression lue depuis le stockage, un fichier ou le serveur. */
export function normalizePhrasal(value: unknown, now = new Date().toISOString()): PhrasalVerb | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const parsed = parsePhrasal(
    typeof v.base === 'string' && typeof v.particle === 'string' ? `${v.base} ${v.particle}` : '',
  );
  if (!parsed) return null;
  const isDate = (x: unknown): x is string => typeof x === 'string' && !Number.isNaN(Date.parse(x));
  const text = (x: unknown) => (typeof x === 'string' ? x : '');
  const addedAt = isDate(v.addedAt) ? v.addedAt : now;
  return {
    id: phrasalId(parsed.base, parsed.particle),
    ...parsed,
    meaning: text(v.meaning),
    example: text(v.example),
    notes: text(v.notes),
    addedAt,
    updatedAt: isDate(v.updatedAt) ? v.updatedAt : addedAt,
  };
}
