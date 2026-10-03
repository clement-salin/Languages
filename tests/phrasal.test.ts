import { describe, expect, it } from 'vitest';
import { expressionsFromBackup, phrasalsFromBackup, toBackupJson } from '../src/domain/backup';
import { cleanExpression, expressionId, normalizeExpression } from '../src/domain/en/expression';
import { irregularForms } from '../src/domain/en/irregular';
import { groupPhrasals, normalizePhrasal, parsePhrasal, particleKey, translatable, type PhrasalVerb } from '../src/domain/en/phrasal';

const T = '2026-10-03T08:00:00.000Z';

function phrasal(base: string, particle: string): PhrasalVerb {
  return normalizePhrasal({ base, particle, meaning: '', addedAt: T })!;
}

describe('parsePhrasal', () => {
  it('sépare le verbe de la particule', () => {
    expect(parsePhrasal('sit down')).toEqual({ base: 'sit', particle: 'down' });
    expect(parsePhrasal('sit in on')).toEqual({ base: 'sit', particle: 'in on' });
  });

  it('accepte « to », les majuscules et les espaces en trop', () => {
    expect(parsePhrasal('  To Get  Over. ')).toEqual({ base: 'get', particle: 'over' });
  });

  it('refuse un verbe seul ou une saisie vide', () => {
    expect(parsePhrasal('sit')).toBeNull();
    expect(parsePhrasal('to sit')).toBeNull();
    expect(parsePhrasal('')).toBeNull();
  });
});

describe('regroupement', () => {
  const list = [phrasal('sit', 'down'), phrasal('get', 'up'), phrasal('sit', 'up'), phrasal('give', 'sth up')];

  it('par verbe, dans l’ordre alphabétique', () => {
    const groups = groupPhrasals(list, 'verb');
    expect(groups.map((g) => g.key)).toEqual(['get', 'give', 'sit']);
    expect(groups[2]!.items.map((p) => p.particle)).toEqual(['down', 'up']);
  });

  it('par particule, sans les mots qui tiennent la place d’un complément', () => {
    expect(particleKey('sth up')).toBe('up');
    const up = groupPhrasals(list, 'particle').find((g) => g.key === 'up');
    expect(up?.items.map((p) => p.base)).toEqual(['get', 'give', 'sit']);
  });
});

describe('normalizePhrasal', () => {
  it('dérive l’identifiant de l’expression', () => {
    expect(normalizePhrasal({ base: 'Sit', particle: 'Down', addedAt: T })).toMatchObject({
      id: 'sit down', base: 'sit', particle: 'down', updatedAt: T,
    });
  });

  it('rejette un enregistrement incomplet', () => {
    expect(normalizePhrasal({ base: 'sit' })).toBeNull();
    expect(normalizePhrasal(null)).toBeNull();
  });
});

describe('verbes irréguliers', () => {
  it('donne prétérit et participe', () => {
    expect(irregularForms('sit')).toEqual({ past: 'sat', participle: 'sat' });
    expect(irregularForms('Get')).toEqual({ past: 'got', participle: 'got / gotten' });
  });

  it('ne devine rien pour un verbe absent de la table', () => {
    expect(irregularForms('look')).toBeNull();
  });
});

describe('sauvegarde', () => {
  it('relit les expressions d’une sauvegarde complète', () => {
    const json = toBackupJson([], [phrasal('sit', 'down')], []);
    expect(phrasalsFromBackup(json).map((p) => p.id)).toEqual(['sit down']);
  });

  it('ignore un fichier qui n’en contient pas', () => {
    expect(phrasalsFromBackup('fahren\ngehen')).toEqual([]);
    expect(phrasalsFromBackup('{"verbs":[]}')).toEqual([]);
  });
});

describe('expressions', () => {
  it('nettoie la saisie et en dérive l’identifiant', () => {
    expect(cleanExpression('  It’s not my  cup of tea. ')).toBe("It's not my cup of tea");
    expect(expressionId('Break the Ice')).toBe('break the ice');
  });

  it('rejette une expression vide', () => {
    expect(normalizeExpression({ text: '  ' })).toBeNull();
    expect(normalizeExpression({ text: 'Spill the beans', addedAt: T })).toMatchObject({
      id: 'spill the beans', text: 'Spill the beans', updatedAt: T,
    });
  });

  it('fait partie de la sauvegarde', () => {
    const json = toBackupJson([], [], [normalizeExpression({ text: 'Spill the beans', addedAt: T })!]);
    expect(expressionsFromBackup(json).map((e) => e.id)).toEqual(['spill the beans']);
    expect(expressionsFromBackup('{"verbs":[]}')).toEqual([]);
  });
});

describe('texte à traduire', () => {
  it('met le phrasal verb à l’infinitif', () => {
    expect(translatable({ base: 'sit', particle: 'up' })).toBe('to sit up');
  });
});
