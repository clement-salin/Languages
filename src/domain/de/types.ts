/**
 * Format du dictionnaire `german-verbs-dict` (verbs.json).
 * Une forme est soit un mot ("fährt"), soit [verbe, particule] pour les
 * verbes à particule séparable (["ruft", "an"]).
 */
export type DictForm = string | [string, string];

export interface DictPersons {
  1?: DictForm;
  2?: DictForm;
  3?: DictForm;
}

export interface DictTense {
  S?: DictPersons;
  P?: DictPersons;
}

export interface DictVerb {
  hasPrefix?: boolean;
  INF?: string;
  PA1?: string;
  PA2?: string[];
  EIZ?: string;
  PRÄ?: DictTense;
  PRT?: DictTense;
  KJ1?: DictTense;
  KJ2?: DictTense;
  IMP?: { S?: string; P?: string };
}

export type Dictionary = Record<string, DictVerb>;

export type SimpleTenseKey = 'PRÄ' | 'PRT' | 'KJ1' | 'KJ2';
