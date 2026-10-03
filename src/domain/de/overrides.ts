import type { DictTense, DictVerb, Dictionary } from './types';

/**
 * Corrections du dictionnaire source pour les verbes les plus fréquents :
 * le dictionnaire contient quelques trous et erreurs sur les auxiliaires et
 * les modaux (ex. « du musstest » manquant). Ces tables font foi.
 */

function tense(forms: string): DictTense {
  const [s1, s2, s3, p1, p2, p3] = forms.split(' ');
  return { S: { 1: s1, 2: s2, 3: s3 }, P: { 1: p1, 2: p2, 3: p3 } };
}

function verb(
  inf: string,
  t: { pra: string; prt: string; kj1: string; kj2: string; pa2: string; imp?: [string, string] },
): DictVerb {
  return {
    INF: inf,
    PRÄ: tense(t.pra),
    PRT: tense(t.prt),
    KJ1: tense(t.kj1),
    KJ2: tense(t.kj2),
    PA2: [t.pa2],
    ...(t.imp ? { IMP: { S: t.imp[0], P: t.imp[1] } } : {}),
  };
}

export const OVERRIDES: Dictionary = {
  sein: verb('sein', {
    pra: 'bin bist ist sind seid sind',
    prt: 'war warst war waren wart waren',
    kj1: 'sei seist sei seien seiet seien',
    kj2: 'wäre wärst wäre wären wärt wären',
    pa2: 'gewesen',
    imp: ['sei', 'seid'],
  }),
  haben: verb('haben', {
    pra: 'habe hast hat haben habt haben',
    prt: 'hatte hattest hatte hatten hattet hatten',
    kj1: 'habe habest habe haben habet haben',
    kj2: 'hätte hättest hätte hätten hättet hätten',
    pa2: 'gehabt',
    imp: ['habe', 'habt'],
  }),
  werden: verb('werden', {
    pra: 'werde wirst wird werden werdet werden',
    prt: 'wurde wurdest wurde wurden wurdet wurden',
    kj1: 'werde werdest werde werden werdet werden',
    kj2: 'würde würdest würde würden würdet würden',
    pa2: 'geworden',
    imp: ['werde', 'werdet'],
  }),
  können: verb('können', {
    pra: 'kann kannst kann können könnt können',
    prt: 'konnte konntest konnte konnten konntet konnten',
    kj1: 'könne könnest könne können könnet können',
    kj2: 'könnte könntest könnte könnten könntet könnten',
    pa2: 'gekonnt',
  }),
  müssen: verb('müssen', {
    pra: 'muss musst muss müssen müsst müssen',
    prt: 'musste musstest musste mussten musstet mussten',
    kj1: 'müsse müssest müsse müssen müsset müssen',
    kj2: 'müsste müsstest müsste müssten müsstet müssten',
    pa2: 'gemusst',
  }),
  dürfen: verb('dürfen', {
    pra: 'darf darfst darf dürfen dürft dürfen',
    prt: 'durfte durftest durfte durften durftet durften',
    kj1: 'dürfe dürfest dürfe dürfen dürfet dürfen',
    kj2: 'dürfte dürftest dürfte dürften dürftet dürften',
    pa2: 'gedurft',
  }),
  sollen: verb('sollen', {
    pra: 'soll sollst soll sollen sollt sollen',
    prt: 'sollte solltest sollte sollten solltet sollten',
    kj1: 'solle sollest solle sollen sollet sollen',
    kj2: 'sollte solltest sollte sollten solltet sollten',
    pa2: 'gesollt',
  }),
  wollen: verb('wollen', {
    pra: 'will willst will wollen wollt wollen',
    prt: 'wollte wolltest wollte wollten wolltet wollten',
    kj1: 'wolle wollest wolle wollen wollet wollen',
    kj2: 'wollte wolltest wollte wollten wolltet wollten',
    pa2: 'gewollt',
  }),
  mögen: verb('mögen', {
    pra: 'mag magst mag mögen mögt mögen',
    prt: 'mochte mochtest mochte mochten mochtet mochten',
    kj1: 'möge mögest möge mögen möget mögen',
    kj2: 'möchte möchtest möchte möchten möchtet möchten',
    pa2: 'gemocht',
  }),
  // « ich möchte » : formellement le Konjunktiv II de mögen, mais appris
  // comme un verbe à part entière ; son passé s'exprime avec « wollen ».
  möchten: verb('möchten', {
    pra: 'möchte möchtest möchte möchten möchtet möchten',
    prt: 'wollte wolltest wollte wollten wolltet wollten',
    kj1: 'möchte möchtest möchte möchten möchtet möchten',
    kj2: 'möchte möchtest möchte möchten möchtet möchten',
    pa2: 'gewollt',
  }),
  wissen: verb('wissen', {
    pra: 'weiß weißt weiß wissen wisst wissen',
    prt: 'wusste wusstest wusste wussten wusstet wussten',
    kj1: 'wisse wissest wisse wissen wisset wissen',
    kj2: 'wüsste wüsstest wüsste wüssten wüsstet wüssten',
    pa2: 'gewusst',
    imp: ['wisse', 'wisst'],
  }),
};

/**
 * Prépare le dictionnaire chargé : applique les corrections ci-dessus et
 * complète les entrées en nouvelle orthographe restées vides
 * (« missbrauchen » reprend les formes de « mißbrauchen »).
 */
export function prepareDictionary(dict: Dictionary): Dictionary {
  Object.assign(dict, OVERRIDES);
  for (const key of Object.keys(dict)) {
    if (!key.startsWith('miss') || dict[key].PRÄ) continue;
    const old = dict[`miß${key.slice(4)}`];
    if (old?.PRÄ) dict[key] = old;
  }
  return dict;
}
