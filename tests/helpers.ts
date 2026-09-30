import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { prepareDictionary } from '../src/core/overrides';
import type { Dictionary } from '../src/core/types';
import { conjugate, lookupVerb, type Conjugation, type ConjugationOptions } from '../src/core/verb';

const require = createRequire(import.meta.url);

export const dict: Dictionary = prepareDictionary(
  JSON.parse(readFileSync(require.resolve('german-verbs-dict/dist/verbs.json'), 'utf8')),
);

export function conj(input: string, options?: ConjugationOptions): Conjugation {
  const result = lookupVerb(dict, input);
  if (!result.ok) throw new Error(`${input}: ${result.reason}`);
  return conjugate(result.verb, options);
}

/** Formes d'un temps : ['fahre', 'fährst', …]. */
export function forms(c: Conjugation, id: string): string[] {
  const tense = c.tenses.find((t) => t.id === id);
  if (!tense) throw new Error(`temps inconnu : ${id}`);
  return tense.forms.map((f) => f?.text ?? '—');
}

export function parts(c: Conjugation): string {
  const p = c.principalParts;
  return `${p.infinitive} – ${p.present3} – ${p.preterite3} – ${p.perfect3}`;
}
