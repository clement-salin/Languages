import type { SimpleTenseKey } from './types';

/**
 * Le dictionnaire source utilise en partie l'ancienne orthographe
 * (avant la réforme de 1996) : « muß », « wußte », « läßt », « schloß »…
 * Depuis la réforme, « ß » après une voyelle brève s'écrit « ss ».
 *
 * Dans l'ancienne orthographe, « ß » entre deux voyelles indique toujours une
 * voyelle longue (« ließen », « aßen ») : on ne touche donc qu'aux « ß » en fin
 * de mot ou devant une consonne, et on décide selon le verbe et le temps.
 */

const VOWELS = 'aeiouäöüy';
const LONG_BEFORE = ['ie', 'ei', 'ai', 'au', 'äu', 'eu'];

export interface OrthographyContext {
  /** Infinitif du verbe (de base), en minuscules. */
  infinitive: string;
  /** Temps d'où vient la forme, s'il s'agit d'un temps simple. */
  tense?: SimpleTenseKey;
}

export function modernize(form: string, ctx: OrthographyContext): string {
  let word = form.replace(/(^|\s)miß/g, '$1miss');
  if (!word.includes('ß')) return word;

  const inf = ctx.infinitive;
  // Verbe à voyelle brève à l'infinitif : müssen, lassen, essen, passen…
  const shortStem = inf.includes('ss');
  // Verbe à voyelle longue à l'infinitif : schließen, genießen, beißen…
  const longStem = inf.includes('ß');
  const past = ctx.tense === 'PRT' || ctx.tense === 'KJ2';

  let out = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (ch !== 'ß') {
      out += ch;
      continue;
    }
    const next = word[i + 1] ?? '';
    const prev = word[i - 1] ?? '';
    const prev2 = word.slice(Math.max(0, i - 2), i);
    const keep =
      (next !== '' && VOWELS.includes(next)) || LONG_BEFORE.includes(prev2) || !shouldConvert();
    out += keep ? 'ß' : 'ss';

    function shouldConvert(): boolean {
      if (shortStem) {
        // aß, fraß, maß, vergaß (prétérit fort) restent longs ;
        // mais paßte → passte (prétérit faible en -te).
        const weakPast = word.slice(i + 1, i + 3) === 'te';
        if (past && (prev === 'a' || prev === 'ä') && !weakPast) return false;
        return true;
      }
      if (longStem) {
        // schloß → schloss, genoß → genoss, biß → biss (mais stieß, hieß restent).
        return ctx.tense === 'PRT' && (prev === 'o' || prev === 'i');
      }
      return false;
    }
  }
  return out;
}
