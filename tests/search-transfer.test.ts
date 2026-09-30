import { describe, expect, it } from 'vitest';
import { levenshtein, VerbIndex } from '../src/core/search';
import { parseImport, toCsv } from '../src/transfer';
import { dict } from './helpers';

describe('recherche', () => {
  const index = new VerbIndex(dict);

  it('complète un début de mot', () => {
    expect(index.complete('fah')).toContain('fahren');
    expect(index.complete('sich fre')).toContain('sich freuen');
    expect(index.complete('f')).toEqual([]);
  });

  it('propose des corrections', () => {
    expect(index.closest('shreiben')).toContain('schreiben');
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('import / export', () => {
  it('lit un CSV avec en-tête et guillemets', () => {
    const csv = '﻿infinitif;traduction\nfahren;conduire\n"sich freuen";"se réjouir; être content"\n';
    expect(parseImport(csv)).toEqual([
      { input: 'fahren', translation: 'conduire' },
      { input: 'sich freuen', translation: 'se réjouir; être content' },
    ]);
  });

  it('lit une simple liste de verbes', () => {
    expect(parseImport('gehen\nkommen\n\n')).toEqual([
      { input: 'gehen', translation: '' },
      { input: 'kommen', translation: '' },
    ]);
  });

  it('relit une sauvegarde JSON', () => {
    const json = JSON.stringify({ verbs: [{ id: 'fahren', translation: 'conduire', notes: 'n', addedAt: '2026-01-01T00:00:00.000Z', auxiliary: 'haben' }, { nope: 1 }] });
    const [entry, ...rest] = parseImport(json);
    expect(rest).toEqual([]);
    expect(entry.input).toBe('fahren');
    expect(entry.saved).toMatchObject({ notes: 'n', auxiliary: 'haben' });
  });

  it('échappe les cellules CSV', () => {
    const csv = toCsv([{
      verb: { id: 'fahren', translation: 'aller; conduire', notes: 'dit "oui"', addedAt: '2026-09-30T10:00:00.000Z' },
      principalParts: 'fahren – fährt – fuhr – ist gefahren',
      verbClass: 'fort',
      auxiliary: 'sein',
    }]);
    expect(csv.split('\r\n')[1]).toBe('fahren;"aller; conduire";fahren – fährt – fuhr – ist gefahren;fort;sein;2026-09-30;"dit ""oui"""');
  });
});
