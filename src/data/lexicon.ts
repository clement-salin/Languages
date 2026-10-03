import dictionaryUrl from 'german-verbs-dict/dist/verbs.json?url';
import { prepareDictionary } from '../domain/de/overrides';
import { VerbIndex } from '../domain/de/search';
import type { Dictionary } from '../domain/de/types';
import { conjugate, lookupVerb, type Conjugation, type LookupResult } from '../domain/de/verb';
import type { SavedVerb } from '../domain/de/saved-verb';

/** Dictionnaire chargé + fonctions de recherche et de conjugaison. */
export class Lexicon {
  readonly index: VerbIndex;
  private cache = new Map<string, Conjugation | null>();

  constructor(private readonly dict: Dictionary) {
    this.index = new VerbIndex(dict);
  }

  lookup(input: string): LookupResult {
    return lookupVerb(this.dict, input);
  }

  /** Conjugaison d'un verbe du carnet (null s'il n'est plus reconnu). */
  conjugateSaved(saved: SavedVerb): Conjugation | null {
    const key = JSON.stringify([saved.id, saved.auxiliary, saved.reflexiveCase, saved.separable]);
    if (!this.cache.has(key)) {
      const result = this.lookup(saved.id);
      this.cache.set(
        key,
        result.ok
          ? conjugate(result.verb, {
              auxiliary: saved.auxiliary,
              reflexiveCase: saved.reflexiveCase,
              separable: saved.separable,
            })
          : null,
      );
    }
    return this.cache.get(key) ?? null;
  }
}

export async function loadLexicon(): Promise<Lexicon> {
  const response = await fetch(dictionaryUrl);
  if (!response.ok) throw new Error(`Dictionnaire indisponible (HTTP ${response.status})`);
  const dict = (await response.json()) as Dictionary;
  return new Lexicon(prepareDictionary(dict));
}
