import { describe, expect, it } from 'vitest';
import { parseSyncRequest } from '../server/sync-request';

const T = '2026-10-01T10:00:00.000Z';

describe('validation d’une demande de synchronisation', () => {
  it('accepte une demande bien formée et ignore les collections inconnues', () => {
    const parsed = parseSyncRequest({
      since: T,
      collections: { deVerbs: { changes: [{ id: 'fahren', updatedAt: T, translation: 'conduire' }] }, inconnue: {} },
    });
    expect(parsed).toEqual({
      since: T,
      collections: { deVerbs: { changes: [{ id: 'fahren', updatedAt: T, translation: 'conduire' }], deletions: [] } },
    });
  });

  it('prend un premier échange sans date', () => {
    expect(parseSyncRequest({ collections: {} })).toEqual({ since: null, collections: {} });
  });

  it.each([
    ['rien', null],
    ['sans collections', {}],
    ['date illisible', { since: 'hier', collections: {} }],
    ['collection qui n’est pas un objet', { collections: { deVerbs: 'abc' } }],
    ['changements qui ne sont pas une liste', { collections: { deVerbs: { changes: 'abc' } } }],
    ['identifiant qui n’est pas un texte', { collections: { deVerbs: { changes: [{ id: { x: 1 }, updatedAt: T }] } } }],
    ['identifiant vide', { collections: { deVerbs: { changes: [{ id: ' ', updatedAt: T }] } } }],
    ['identifiant démesuré', { collections: { deVerbs: { changes: [{ id: 'x'.repeat(301), updatedAt: T }] } } }],
    ['date de fiche illisible', { collections: { deVerbs: { changes: [{ id: 'fahren', updatedAt: 5 }] } } }],
    ['suppression sans date', { collections: { enPhrasals: { deletions: [{ id: 'sit down' }] } } }],
  ])('refuse : %s', (_, body) => {
    expect(typeof parseSyncRequest(body)).toBe('string');
  });
});
