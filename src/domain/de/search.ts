import { parseInput, spellingVariants } from './verb';
import type { Dictionary } from './types';

/** Index des infinitifs, trié pour l'autocomplétion. */
export class VerbIndex {
  private readonly keys: string[];

  constructor(dict: Dictionary) {
    this.keys = Object.keys(dict)
      .filter((k) => !k.includes(' '))
      .sort((a, b) => a.length - b.length || a.localeCompare(b, 'de'));
  }

  get size(): number {
    return this.keys.length;
  }

  /** Infinitifs qui commencent par la saisie (« geh » → gehen, gehören…). */
  complete(raw: string, limit = 8): string[] {
    const { reflexive, words } = parseInput(raw);
    if (words.length !== 1) return [];
    const typed = words[0].toLowerCase();
    if (typed.length < 2) return [];
    const prefixes = spellingVariants(typed);
    const out: string[] = [];
    for (const key of this.keys) {
      if (prefixes.some((p) => key.startsWith(p))) {
        out.push(reflexive ? `sich ${key}` : key);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  /** Infinitifs proches d'un mot introuvable (fautes de frappe). */
  closest(word: string, limit = 5): string[] {
    const target = word.toLowerCase();
    const maxDistance = target.length <= 5 ? 1 : 2;
    const scored: [string, number][] = [];
    for (const key of this.keys) {
      if (Math.abs(key.length - target.length) > maxDistance) continue;
      const d = levenshtein(target, key, maxDistance);
      if (d <= maxDistance) scored.push([key, d]);
    }
    scored.sort((a, b) => a[1] - b[1] || a[0].length - b[0].length);
    return scored.slice(0, limit).map(([k]) => k);
  }
}

/** Distance d'édition, avec abandon anticipé au-delà de `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}
