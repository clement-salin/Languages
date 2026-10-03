import { describe, expect, it } from 'vitest';
import { modernize } from '../src/domain/de/orthography';

describe('nouvelle orthographe', () => {
  it.each([
    ['muß', 'müssen', 'PRÄ', 'muss'],
    ['wußte', 'wissen', 'PRT', 'wusste'],
    ['läßt', 'lassen', 'PRÄ', 'lässt'],
    ['laß', 'lassen', undefined, 'lass'],
    ['paßte', 'passen', 'PRT', 'passte'],
    ['schloß', 'schließen', 'PRT', 'schloss'],
    ['genoßt', 'genießen', 'PRT', 'genosst'],
    ['mißverstehen', 'mißverstehen', undefined, 'missverstehen'],
  ] as const)('%s → %s', (form, infinitive, tense, expected) => {
    expect(modernize(form, { infinitive, tense })).toBe(expected);
  });

  it.each([
    ['aß', 'essen', 'PRT'],
    ['vergaßt', 'vergessen', 'PRT'],
    ['ließ', 'lassen', 'PRT'],
    ['weiß', 'wissen', 'PRÄ'],
    ['stieß', 'stoßen', 'PRT'],
    ['schließt', 'schließen', 'PRÄ'],
    ['saß', 'sitzen', 'PRT'],
    ['äßen', 'essen', 'KJ2'],
  ] as const)('garde %s', (form, infinitive, tense) => {
    expect(modernize(form, { infinitive, tense })).toBe(form);
  });
});
