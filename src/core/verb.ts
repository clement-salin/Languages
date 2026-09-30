import { auxiliaryFor, type Auxiliary, type AuxiliaryInfo } from './auxiliary';
import { modernize } from './orthography';
import type { DictForm, DictVerb, Dictionary, SimpleTenseKey } from './types';

/** Particules inséparables : un verbe qui commence par l'une d'elles n'est pas « à particule ». */
const INSEPARABLE = ['be', 'emp', 'ent', 'er', 'ge', 'miss', 'miß', 'ver', 'zer'];

/**
 * Particules tantôt séparables, tantôt inséparables selon le verbe :
 * « er setzt über » (il traverse) / « er übersetzt » (il traduit).
 */
const DUAL_PARTICLES = ['durch', 'hinter', 'über', 'um', 'unter', 'voll', 'wider', 'wieder'];

/** Particules séparables courantes. */
const PARTICLES = new Set([
  'ab', 'an', 'auf', 'aus', 'bei', 'dabei', 'dar', 'durch', 'ein', 'entgegen', 'fern',
  'fest', 'fort', 'frei', 'heim', 'her', 'herauf', 'heraus', 'herein', 'herum', 'herunter',
  'hin', 'hinauf', 'hinaus', 'hinein', 'hinunter', 'hoch', 'los', 'mit', 'nach', 'statt',
  'teil', 'um', 'vor', 'voran', 'vorbei', 'weg', 'weiter', 'wieder', 'zu', 'zurück',
  'zusammen',
]);

/**
 * Homonymes pour lesquels le dictionnaire mélange formes fortes et faibles :
 * « bereiten » (préparer) est faible — bereitete, pas « beritt » (chevaucher).
 */
const WEAK_ONLY = new Set(['bereiten']);

const MODALS = new Set(['können', 'müssen', 'dürfen', 'sollen', 'wollen', 'mögen', 'möchten']);
const IRREGULAR = new Set(['sein', 'haben', 'werden', 'tun', 'wissen']);

export type VerbClass = 'weak' | 'strong' | 'mixed' | 'modal' | 'irregular';
export type ReflexiveCase = 'acc' | 'dat';
export type Separability = 'separable' | 'inseparable' | 'both';

/** Verbes pronominaux dont le pronom est au datif (sich etwas vorstellen…). */
const DATIVE_REFLEXIVES = new Set([
  'abgewöhnen', 'aneignen', 'angewöhnen', 'ansehen', 'anschauen', 'ausdenken',
  'einbilden', 'erlauben', 'leisten', 'merken', 'überlegen', 'vornehmen',
  'vorstellen', 'wünschen',
]);

export const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] as const;
const SLOTS = [
  ['S', '1'], ['S', '2'], ['S', '3'], ['P', '1'], ['P', '2'], ['P', '3'],
] as const;

const REFLEXIVE_PRONOUNS: Record<ReflexiveCase, string[]> = {
  acc: ['mich', 'dich', 'sich', 'uns', 'euch', 'sich'],
  dat: ['mir', 'dir', 'sich', 'uns', 'euch', 'sich'],
};

/** Formes des auxiliaires, en orthographe moderne. */
const AUX_FORMS = {
  haben: {
    PRÄ: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'],
    PRT: ['hatte', 'hattest', 'hatte', 'hatten', 'hattet', 'hatten'],
    KJ2: ['hätte', 'hättest', 'hätte', 'hätten', 'hättet', 'hätten'],
    KJ1: ['habe', 'habest', 'habe', 'haben', 'habet', 'haben'],
  },
  sein: {
    PRÄ: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
    PRT: ['war', 'warst', 'war', 'waren', 'wart', 'waren'],
    KJ2: ['wäre', 'wärst', 'wäre', 'wären', 'wärt', 'wären'],
    KJ1: ['sei', 'seist', 'sei', 'seien', 'seiet', 'seien'],
  },
  werden: {
    PRÄ: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'],
    PRT: ['wurde', 'wurdest', 'wurde', 'wurden', 'wurdet', 'wurden'],
    KJ2: ['würde', 'würdest', 'würde', 'würden', 'würdet', 'würden'],
    KJ1: ['werde', 'werdest', 'werde', 'werden', 'werdet', 'werden'],
  },
} as const;

/** Un verbe du dictionnaire, analysé (particule, verbe de base, pronominal…). */
export interface Verb {
  /** Infinitif affiché, sans « sich » (ex. « anrufen », « Rad fahren »). */
  infinitive: string;
  reflexive: boolean;
  /** Particule : « an » dans anrufen, « über » dans übersetzen, « Rad » dans Rad fahren. */
  prefix: string | null;
  /** La particule est-elle séparable (ruft an) ou non (übersetzt) ? */
  separability: Separability;
  /** Particule écrite en un mot séparé à l'infinitif (Rad fahren, spazieren gehen). */
  prefixIsWord: boolean;
  /** Verbe de base (« rufen » pour anrufen) ; égal à l'infinitif sinon. */
  base: string;
  /** Entrée du dictionnaire du verbe lui-même, si elle existe. */
  own: DictVerb | null;
  /** Entrée du verbe de base (formes de repli pour les verbes à particule). */
  baseInfo: DictVerb | null;
}

export interface ParsedInput {
  reflexive: boolean;
  words: string[];
}

/** « sich Freuen  » → { reflexive: true, words: ['freuen'] } */
export function parseInput(raw: string): ParsedInput {
  let words = raw.trim().replace(/[!?.;,]+$/g, '').split(/\s+/).filter(Boolean);
  let reflexive = false;
  if (words.length > 1 && /^\(?sich\)?$/i.test(words[0])) {
    reflexive = true;
    words = words.slice(1);
  }
  if (words.length === 0) return { reflexive, words };
  // Le verbe lui-même est en minuscules ; les mots qui précèdent gardent leur
  // casse pour l'instant (« Rad fahren », « Sorgen machen »).
  words[words.length - 1] = words[words.length - 1].toLowerCase();
  return { reflexive, words };
}

/** Variantes d'écriture à essayer quand un mot n'est pas trouvé tel quel. */
export function spellingVariants(word: string): string[] {
  const out = new Set<string>([word]);
  const umlauts = word.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü');
  out.add(umlauts);
  for (const w of [word, umlauts]) {
    out.add(w.replace(/ss/g, 'ß'));
    // Une seule occurrence remplacée à la fois (ex. « schliessen » → « schließen »).
    let idx = w.indexOf('ss');
    while (idx !== -1) {
      out.add(w.slice(0, idx) + 'ß' + w.slice(idx + 2));
      idx = w.indexOf('ss', idx + 1);
    }
  }
  return [...out];
}

/** Trouve la clé du dictionnaire correspondant à un mot, en tolérant les variantes. */
export function findKey(dict: Dictionary, word: string): string | null {
  for (const candidate of spellingVariants(word)) {
    if (Object.hasOwn(dict, candidate)) return candidate;
  }
  return null;
}

function pa2List(info: DictVerb | null | undefined): string[] {
  return info?.PA2 ?? [];
}

/** Particule présente dans les formes du dictionnaire (["ruft", "an"] → "an"). */
function prefixFromForms(info: DictVerb): string | null {
  for (const tense of ['PRÄ', 'PRT', 'KJ2', 'KJ1'] as const) {
    for (const n of ['S', 'P'] as const) {
      for (const p of ['1', '2', '3'] as const) {
        const f = info[tense]?.[n]?.[p];
        if (Array.isArray(f)) return f[1];
      }
    }
  }
  return null;
}

/**
 * Découpe « particule + verbe de base » quand le dictionnaire ne le fait pas
 * (kennenlernen, bekanntgeben, weiterentwickeln…). Le participe passé du verbe
 * doit alors valoir « particule + participe du verbe de base » (kennen + gelernt).
 */
function splitCompound(dict: Dictionary, key: string, info: DictVerb): { prefix: string; base: string } | null {
  const own = pa2List(info);
  for (let i = 2; i <= key.length - 3; i++) {
    const prefix = key.slice(0, i);
    const base = key.slice(i);
    if (INSEPARABLE.includes(prefix)) continue;
    const baseInfo = dict[base];
    if (!baseInfo) continue;
    // Entrée vide (seulement « hasPrefix ») : on se fie au découpage.
    if (own.length === 0 && !info.PRÄ) return { prefix, base };
    const match = pa2List(baseInfo).some(
      (p) => own.includes(prefix + p) && (p.startsWith('ge') || !info.PRÄ),
    );
    if (match) return { prefix, base };
  }
  return null;
}

/**
 * Pour « über », « unter », « wieder »… le dictionnaire marque tous les verbes
 * comme séparables. Le participe passé permet de trancher :
 * « übergesetzt » → séparable, « übersetzt » → inséparable, les deux → both.
 */
function separabilityOf(prefix: string, participles: string[], baseParticiples: string[]): Separability {
  if (!DUAL_PARTICLES.includes(prefix)) return 'separable';
  const withGe = baseParticiples.filter((p) => p.startsWith('ge'));
  if (withGe.length === 0) return 'separable';
  const sep = withGe.some((p) => participles.includes(prefix + p));
  const insep = withGe.some((p) => participles.includes(prefix + p.slice(2)));
  if (sep && insep) return 'both';
  if (insep) return 'inseparable';
  return 'separable';
}

export type LookupResult =
  | { ok: true; verb: Verb }
  | { ok: false; reason: 'empty' | 'not-found' };

/** Analyse une saisie (« sich anziehen », « Rad fahren », « fahren »…). */
export function lookupVerb(dict: Dictionary, raw: string): LookupResult {
  const { reflexive, words } = parseInput(raw);
  if (words.length === 0) return { ok: false, reason: 'empty' };

  if (words.length > 1) {
    // Majuscule ajoutée par le clavier du téléphone (« Spazieren gehen ») :
    // on la retire si le mot est une particule ou un verbe, mais on garde
    // celle des noms (« Rad fahren », « sich Sorgen machen »).
    const leading = words.slice(0, -1).map((w, i) => {
      const lower = w.toLowerCase();
      const autoCapitalized = i === 0 && !reflexive && Object.hasOwn(dict, lower);
      return PARTICLES.has(lower) || autoCapitalized ? lower : w;
    });
    // « an rufen » → anrufen
    const joined = findKey(dict, leading.join('') + words[words.length - 1]);
    if (joined && leading.length === 1 && PARTICLES.has(leading[0])) {
      return lookupVerb(dict, `${reflexive ? 'sich ' : ''}${joined}`);
    }
    // Locution verbale en plusieurs mots (Rad fahren, spazieren gehen) : le
    // dernier mot est le verbe, les autres se comportent comme une particule.
    const baseKey = findKey(dict, words[words.length - 1]);
    if (!baseKey) return { ok: false, reason: 'not-found' };
    const prefix = leading.join(' ');
    return {
      ok: true,
      verb: {
        infinitive: `${prefix} ${baseKey}`,
        reflexive,
        prefix,
        separability: 'separable',
        prefixIsWord: true,
        base: baseKey,
        own: null,
        baseInfo: dict[baseKey],
      },
    };
  }

  const key = findKey(dict, words[0].toLowerCase());
  if (!key) return guessSeparable(dict, words[0].toLowerCase(), reflexive);
  const info = dict[key];
  const infinitive = modernize(key, { infinitive: key });

  let prefix: string | null = null;
  let base = key;
  if (info.hasPrefix) {
    prefix = prefixFromForms(info);
    if (prefix && key.startsWith(prefix)) {
      base = key.slice(prefix.length);
    } else {
      const split = splitCompound(dict, key, info);
      prefix = split?.prefix ?? null;
      base = split?.base ?? key;
    }
  } else {
    const split = splitCompound(dict, key, info);
    if (split) ({ prefix, base } = split);
  }

  const baseInfo = base === key ? info : dict[base] ?? null;
  const separability = prefix
    ? separabilityOf(prefix, pa2List(info), pa2List(baseInfo))
    : 'separable';

  return {
    ok: true,
    verb: {
      infinitive, reflexive, prefix, separability, prefixIsWord: false, base, own: info, baseInfo,
    },
  };
}

/**
 * Verbe absent du dictionnaire mais formé d'une particule et d'un verbe connu
 * (mitkommen = mit + kommen, herunterladen = herunter + laden).
 */
function guessSeparable(dict: Dictionary, word: string, reflexive: boolean): LookupResult {
  for (let i = word.length - 3; i >= 2; i--) {
    const prefix = word.slice(0, i);
    if (!PARTICLES.has(prefix)) continue;
    const base = findKey(dict, word.slice(i));
    if (!base) continue;
    return {
      ok: true,
      verb: {
        infinitive: prefix + base, reflexive, prefix, separability: 'separable',
        prefixIsWord: false, base, own: null, baseInfo: dict[base],
      },
    };
  }
  return { ok: false, reason: 'not-found' };
}

/* ------------------------------------------------------------------------ */
/* Conjugaison                                                              */
/* ------------------------------------------------------------------------ */

export interface ConjugationOptions {
  auxiliary?: Auxiliary;
  reflexiveCase?: ReflexiveCase;
  /** Pour les verbes à double emploi (übersetzen) : séparable ou non. */
  separable?: boolean;
}

export interface Form {
  /** Forme complète sans pronom sujet : « fährt », « ist gefahren », « ruft an ». */
  text: string;
  /** Forme irrégulière à retenir (changement de radical au présent…). */
  irregular?: boolean;
}

export type TenseId =
  | 'praesens' | 'praeteritum' | 'perfekt' | 'plusquamperfekt' | 'futur1' | 'futur2'
  | 'konjunktiv2' | 'konjunktiv2Wuerde' | 'konjunktiv2Vergangenheit' | 'konjunktiv1';

export interface Tense {
  id: TenseId;
  /** Nom allemand du temps. */
  name: string;
  /** Équivalent en français. */
  french: string;
  /** Six formes (ich, du, er, wir, ihr, sie), null si absente du dictionnaire. */
  forms: (Form | null)[];
}

export interface Imperative {
  du: string;
  ihr: string;
  Sie: string;
}

export interface Conjugation {
  verb: Verb;
  /** « sich freuen », « anrufen »… */
  displayInfinitive: string;
  auxiliary: Auxiliary;
  auxiliaryInfo: AuxiliaryInfo;
  reflexiveCase: ReflexiveCase;
  /** La particule est séparée dans cette conjugaison. */
  separable: boolean;
  verbClass: VerbClass;
  /** Changement de voyelle au présent (du fährst, er gibt). */
  presentStemChange: boolean;
  /** Participe(s) passé(s), la forme retenue en premier. */
  participles: string[];
  /** Formes principales : fahren – fährt – fuhr – ist gefahren. */
  principalParts: { infinitive: string; present3: string; preterite3: string; perfect3: string };
  tenses: Tense[];
  imperative: Imperative | null;
  /** Des formes manquent dans le dictionnaire. */
  incomplete: boolean;
}

export const TENSE_LABELS: Record<TenseId, { name: string; french: string }> = {
  praesens: { name: 'Präsens', french: 'présent' },
  praeteritum: { name: 'Präteritum', french: 'prétérit (imparfait / passé simple)' },
  perfekt: { name: 'Perfekt', french: 'passé composé' },
  plusquamperfekt: { name: 'Plusquamperfekt', french: 'plus-que-parfait' },
  futur1: { name: 'Futur I', french: 'futur' },
  futur2: { name: 'Futur II', french: 'futur antérieur' },
  konjunktiv2: { name: 'Konjunktiv II', french: 'subjonctif II (conditionnel)' },
  konjunktiv2Wuerde: { name: 'Konjunktiv II avec würde', french: 'conditionnel' },
  konjunktiv2Vergangenheit: { name: 'Konjunktiv II passé', french: 'conditionnel passé' },
  konjunktiv1: { name: 'Konjunktiv I', french: 'subjonctif I (discours indirect)' },
};

export const VERB_CLASS_LABELS: Record<VerbClass, string> = {
  weak: 'faible',
  strong: 'fort',
  mixed: 'mixte',
  modal: 'modal',
  irregular: 'irrégulier',
};

export function defaultReflexiveCase(verb: Verb): ReflexiveCase {
  return DATIVE_REFLEXIVES.has(verb.infinitive) ? 'dat' : 'acc';
}

/** Radical de l'infinitif : fahren → fahr, sammeln → sammel, tun → tu. */
function stemOf(infinitive: string): string {
  return infinitive.replace(/e?n$/, '');
}

export function conjugate(verb: Verb, options: ConjugationOptions = {}): Conjugation {
  const { prefix, base } = verb;
  const separable =
    prefix !== null &&
    (verb.separability === 'both' ? options.separable ?? false : verb.separability === 'separable');
  const auxiliaryInfo = auxiliaryFor({
    infinitive: verb.infinitive,
    base,
    separable,
    reflexive: verb.reflexive,
  });
  const auxiliary = options.auxiliary ?? auxiliaryInfo.default;
  const reflexiveCase = options.reflexiveCase ?? defaultReflexiveCase(verb);
  const refl = verb.reflexive ? REFLEXIVE_PRONOUNS[reflexiveCase] : null;
  let incomplete = false;

  // Les formes du verbe lui-même ne sont utilisables que si elles séparent la
  // particule ([« ruft », « an »]) ou si le verbe n'a pas de particule.
  const own = verb.own && (verb.own.hasPrefix || !prefix) ? verb.own : null;

  /** Verbe conjugué seul, sans particule (« ruft » pour anrufen). */
  function stemForm(tense: SimpleTenseKey, i: number): string | null {
    if (WEAK_ONLY.has(base) && (tense === 'PRT' || tense === 'KJ2')) return weakPreterite(base, i);
    const [n, p] = SLOTS[i];
    const raw: DictForm | undefined = own?.[tense]?.[n]?.[p] ?? (prefix ? verb.baseInfo?.[tense]?.[n]?.[p] : undefined);
    if (raw === undefined) return null;
    const main = Array.isArray(raw) ? raw[0] : raw;
    return modernize(main, { infinitive: base, tense });
  }

  /** Forme conjuguée, avec la particule collée si elle est inséparable. */
  function finiteForm(tense: SimpleTenseKey, i: number): string | null {
    const main = stemForm(tense, i);
    if (main === null) return null;
    return prefix && !separable ? prefix + main : main;
  }

  const participles = participlesOf(verb, separable);
  const participle = participles[0] ?? null;

  /** Assemble « verbe conjugué + pronom réfléchi + reste ». */
  function build(i: number, finite: string | null, rest: (string | null)[]): Form | null {
    if (finite === null || rest.some((r) => r === null)) {
      incomplete = true;
      return null;
    }
    const parts = [finite];
    if (refl) parts.push(refl[i]);
    for (const r of rest) if (r) parts.push(r);
    return { text: parts.join(' ') };
  }

  const detached = separable ? prefix : null;
  const stem = stemOf(base);
  const stemAlt = stem.replace(/e([lr])$/, '$1'); // sammel → samml, wander → wandr

  function simpleTense(id: TenseId, tense: SimpleTenseKey): Tense {
    const forms = SLOTS.map((_, i) => {
      const form = build(i, finiteForm(tense, i), [detached ?? '']);
      const main = stemForm(tense, i);
      if (form && main && tense === 'PRÄ') {
        form.irregular = !main.startsWith(stem) && !main.startsWith(stemAlt);
      }
      return form;
    });
    return { id, ...TENSE_LABELS[id], forms };
  }

  function composedTense(
    id: TenseId,
    helper: keyof typeof AUX_FORMS,
    helperTense: SimpleTenseKey,
    rest: (string | null)[],
  ): Tense {
    const forms = SLOTS.map((_, i) => build(i, AUX_FORMS[helper][helperTense][i], rest));
    return { id, ...TENSE_LABELS[id], forms };
  }

  const inf = verb.infinitive;
  const tenses: Tense[] = [
    simpleTense('praesens', 'PRÄ'),
    simpleTense('praeteritum', 'PRT'),
    composedTense('perfekt', auxiliary, 'PRÄ', [participle]),
    composedTense('plusquamperfekt', auxiliary, 'PRT', [participle]),
    composedTense('futur1', 'werden', 'PRÄ', [inf]),
    composedTense('futur2', 'werden', 'PRÄ', [participle, auxiliary]),
    simpleTense('konjunktiv2', 'KJ2'),
    composedTense('konjunktiv2Wuerde', 'werden', 'KJ2', [inf]),
    composedTense('konjunktiv2Vergangenheit', auxiliary, 'KJ2', [participle]),
    simpleTense('konjunktiv1', 'KJ1'),
  ];

  const [present, preterite, perfect] = tenses.map((t) => t.forms);
  const displayInfinitive = verb.reflexive ? `sich ${inf}` : inf;

  return {
    verb,
    displayInfinitive,
    auxiliary,
    auxiliaryInfo,
    reflexiveCase,
    separable,
    verbClass: classify(base, stemForm('PRT', 0)),
    presentStemChange: present.some((f) => f?.irregular),
    participles,
    principalParts: {
      infinitive: displayInfinitive,
      present3: present[2]?.text ?? '—',
      preterite3: preterite[2]?.text ?? '—',
      perfect3: perfect[2]?.text ?? '—',
    },
    tenses,
    imperative: imperative(),
    incomplete,
  };

  function imperative(): Imperative | null {
    if (MODALS.has(base)) return null;
    const ihr = finiteForm('PRÄ', 4);
    const sie = base === 'sein' ? 'seien' : finiteForm('PRÄ', 5);
    if (!ihr || !sie) return null;
    const fromDict = (prefix ? verb.baseInfo : verb.own)?.IMP?.S;
    let du = fromDict
      ? modernize(fromDict, { infinitive: base })
      : deriveImperative(stemForm('PRÄ', 1), base);
    du = optionalE(du, base);
    if (prefix && !separable) du = prefix + du;
    const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ');
    return {
      du: join(du, refl?.[1] ?? null, detached),
      ihr: join(ihr, refl?.[4] ?? null, detached),
      Sie: join(sie, 'Sie', refl ? 'sich' : null, detached),
    };
  }
}

/** Participes passés du verbe, la forme à utiliser en premier. */
function participlesOf(verb: Verb, separable: boolean): string[] {
  const { prefix, base } = verb;
  const baseParts = pa2List(verb.baseInfo);
  const fix = (p: string) => modernize(p, { infinitive: base });
  let list: string[];
  if (verb.prefixIsWord) {
    list = baseParts.map((p) => `${prefix} ${p}`);
  } else {
    list = pa2List(verb.own);
    if (prefix && verb.separability === 'both') {
      // Garder la forme qui correspond à l'emploi choisi (übergesetzt / übersetzt).
      const wanted = baseParts
        .filter((p) => p.startsWith('ge'))
        .map((p) => (separable ? prefix + p : prefix + p.slice(2)));
      list = list.filter((p) => wanted.includes(p));
    }
    if (list.length === 0 && prefix) {
      list = baseParts.map((p) => (separable || !p.startsWith('ge') ? prefix + p : prefix + p.slice(2)));
    }
  }
  if (WEAK_ONLY.has(base)) list = list.filter((p) => p.endsWith('t'));
  const unique = [...new Set(list.map(fix))];
  // gewusst plutôt que wusst ; geworden plutôt que worden.
  return unique.sort((a, b) => Number(b.includes('ge')) - Number(a.includes('ge')));
}

/** Prétérit faible : bereiten → bereitete, bereitetest… */
function weakPreterite(base: string, i: number): string {
  const stem = stemOf(base);
  const linking = /(?:[dt]|[^aeiouäöülrmnh][mn]|[^aeiouäöü]h[mn])$/.test(stem) ? 'e' : '';
  return stem + linking + ['te', 'test', 'te', 'ten', 'tet', 'ten'][i];
}

/**
 * Impératif singulier quand le dictionnaire ne le donne pas : radical + e,
 * sauf pour les verbes en e → i (du gibst → gib, du liest → lies).
 */
function deriveImperative(presentDu: string | null, base: string): string {
  const stem = stemOf(base);
  if (presentDu && /e/.test(stem) && !presentDu.startsWith(stem)) {
    const derived = /[sßzx]$/.test(stem) ? presentDu.replace(/t$/, '') : presentDu.replace(/st$/, '');
    if (/i/.test(derived) && !/[äöü]/.test(derived)) return derived;
  }
  // sammeln → sammle ; wandern → wandere
  return base.endsWith('eln') ? `${stem.slice(0, -2)}le` : `${stem}e`;
}

/**
 * « komme » → « komm(e) » : le -e final de l'impératif est facultatif, sauf
 * après -d, -t, -ig, consonne + m/n (atme, öffne) et pour les verbes en -eln/-ern.
 */
function optionalE(form: string, base: string): string {
  if (!form.endsWith('e')) return form;
  const stem = form.slice(0, -1);
  // arbeite, finde, entschuldige, atme, öffne, rechne — mais komm(e), wohn(e)
  if (/(?:[dt]|[^aeiouäöü]ig|[^aeiouäöülrmnh][mn]|[^aeiouäöü]h[mn])$/.test(stem)) return form;
  if (/e[lr]n$/.test(base)) return form;
  return `${stem}(e)`;
}

function classify(base: string, preterite: string | null): VerbClass {
  if (MODALS.has(base)) return 'modal';
  if (IRREGULAR.has(base)) return 'irregular';
  if (!preterite) return 'weak';
  if (!/te$/.test(preterite)) return 'strong';
  const pastStem = preterite.replace(/e?te$/, '');
  return pastStem === stemOf(base) ? 'weak' : 'mixed';
}
