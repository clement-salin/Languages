/**
 * Choix de l'auxiliaire (haben / sein) pour les temps composés.
 *
 * Le dictionnaire ne donne pas cette information : on utilise des listes de
 * verbes de mouvement / changement d'état. L'utilisateur peut toujours
 * corriger l'auxiliaire d'un verbe dans l'application.
 */

export type Auxiliary = 'haben' | 'sein';

export interface AuxiliaryInfo {
  /** Auxiliaire proposé par défaut. */
  default: Auxiliary;
  /** Le verbe s'emploie aussi avec l'autre auxiliaire (selon le sens). */
  both: boolean;
}

/** Verbes (de base) qui se conjuguent avec « sein ». */
const SEIN = new Set([
  'begegnen', 'bleiben', 'bummeln', 'eilen', 'erblinden', 'ergrauen', 'erkranken',
  'erlöschen', 'erröten', 'erscheinen', 'ertrinken', 'erwachen', 'erfrieren',
  'entfliehen', 'entgehen', 'entgleisen', 'entkommen', 'entstehen', 'entweichen',
  'explodieren', 'fallen', 'flüchten', 'fliehen', 'fließen', 'folgen', 'gedeihen',
  'gehen', 'gelangen', 'gelingen', 'genesen', 'geraten', 'geschehen', 'gleiten',
  'hüpfen', 'joggen', 'klettern', 'kommen', 'kriechen', 'landen', 'laufen',
  'marschieren', 'misslingen', 'mißlingen', 'passieren', 'platzen', 'radeln',
  'rennen', 'reisen', 'rutschen', 'sausen', 'scheitern', 'schleichen',
  'schlendern', 'schreiten', 'schrumpfen', 'schwimmen', 'sein', 'sinken',
  'spazieren', 'springen', 'stolpern', 'steigen', 'sterben', 'strömen',
  'verarmen', 'verblühen', 'verdursten', 'verfallen', 'vergehen', 'verhungern',
  'verreisen', 'verschwinden', 'verstummen', 'verunglücken', 'verwelken',
  'wachsen', 'wandern', 'weichen', 'werden', 'zerfallen', 'zerplatzen',
  'zerspringen', 'zerfließen',
  // Verbes à particule dont la base prend « haben »
  'aufstehen', 'aufwachen', 'einschlafen', 'zurückkehren', 'umkehren',
  'einziehen', 'umziehen', 'wegziehen', 'zusammenziehen',
]);

/**
 * Verbes qui prennent l'un ou l'autre auxiliaire selon le sens :
 * « ich bin nach Berlin gefahren » / « ich habe das Auto gefahren ».
 * La valeur est l'auxiliaire proposé par défaut.
 */
const BOTH = new Map<string, Auxiliary>([
  ['fahren', 'sein'], ['fliegen', 'sein'], ['reiten', 'sein'], ['rudern', 'sein'],
  ['segeln', 'sein'], ['tauchen', 'sein'], ['stürzen', 'sein'], ['schmelzen', 'sein'],
  ['treten', 'sein'],
  ['ausziehen', 'haben'], ['brechen', 'haben'], ['zerbrechen', 'haben'],
  ['rollen', 'haben'], ['trocknen', 'haben'], ['verderben', 'haben'],
]);

/** Détermine l'auxiliaire des temps composés d'un verbe. */
export function auxiliaryFor(options: {
  infinitive: string;
  base: string;
  separable: boolean;
  reflexive: boolean;
}): AuxiliaryInfo {
  const { infinitive, base, separable, reflexive } = options;
  if (reflexive) return { default: 'haben', both: false };
  if (SEIN.has(infinitive)) return { default: 'sein', both: false };
  const both = BOTH.get(infinitive);
  if (both) return { default: both, both: true };
  if (separable) {
    // ankommen, aussteigen, abfahren… suivent le verbe de base.
    if (SEIN.has(base)) return { default: 'sein', both: false };
    const baseBoth = BOTH.get(base);
    if (baseBoth) return { default: baseBoth, both: true };
  }
  return { default: 'haben', both: false };
}
