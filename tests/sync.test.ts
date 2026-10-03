import { describe, expect, it } from 'vitest';
import type { Syncable } from '../src/domain/sync';
import { acceptsIncoming, mergeIncoming, requestSince, selectOutgoing, SYNCABLE_COLLECTIONS } from '../src/domain/sync';

// Repris de batch-cooking : le protocole est le même, seules les collections changent.
function recipe(id: string, updatedAt: string): Syncable {
  return { id, updatedAt };
}

const T1 = '2026-09-18T10:00:00.000Z';
const T2 = '2026-09-18T11:00:00.000Z';
const T3 = '2026-09-18T12:00:00.000Z';

describe('selectOutgoing', () => {
  const local = [recipe('a', T1), recipe('b', T3)];
  const tombstones = [{ id: 'c', deletedAt: T1 }, { id: 'd', deletedAt: T3 }];

  it('envoie tout au premier échange', () => {
    const out = selectOutgoing(local, tombstones, null);
    expect(out.changes).toHaveLength(2);
    expect(out.deletions).toHaveLength(2);
  });

  it('n’envoie ensuite que ce qui a bougé depuis', () => {
    const out = selectOutgoing(local, tombstones, T2);
    expect(out.changes.map((r) => r.id)).toEqual(['b']);
    expect(out.deletions.map((t) => t.id)).toEqual(['d']);
  });

  it('n’envoie rien quand rien n’a bougé', () => {
    const out = selectOutgoing(local, tombstones, T3);
    expect(out.changes).toEqual([]);
    expect(out.deletions).toEqual([]);
  });
});

describe('mergeIncoming', () => {
  it('accepte une version distante plus récente', () => {
    const result = mergeIncoming([recipe('a', T1)], [recipe('a', T2)], []);
    expect(result.upserts.map((r) => r.updatedAt)).toEqual([T2]);
    expect(result.removals).toEqual([]);
  });

  it('ignore une version distante plus ancienne', () => {
    const result = mergeIncoming([recipe('a', T2)], [recipe('a', T1)], []);
    expect(result.upserts).toEqual([]);
  });

  it('ignore une version distante identique, pour ne rien réécrire', () => {
    expect(mergeIncoming([recipe('a', T2)], [recipe('a', T2)], []).upserts).toEqual([]);
  });

  it('insère un enregistrement venue d’un autre appareil', () => {
    const result = mergeIncoming([], [recipe('neuve', T1)], []);
    expect(result.upserts.map((r) => r.id)).toEqual(['neuve']);
  });

  it('applique une suppression plus récente que l’enregistrement local', () => {
    const result = mergeIncoming([recipe('a', T1)], [], [{ id: 'a', deletedAt: T2 }]);
    expect(result.removals).toEqual(['a']);
  });

  it('garde un enregistrement modifiée localement après la suppression distante', () => {
    const result = mergeIncoming([recipe('a', T3)], [], [{ id: 'a', deletedAt: T2 }]);
    expect(result.removals).toEqual([]);
  });

  it('ignore la suppression d’un enregistrement absent', () => {
    expect(mergeIncoming([], [], [{ id: 'inconnue', deletedAt: T3 }]).removals).toEqual([]);
  });

  it('supprime plutôt que d’insérer quand la suppression est postérieure', () => {
    // L’enregistrement arrive et sa suppression aussi : c'est la plus récente
    // des deux qui doit l'emporter.
    const result = mergeIncoming([], [recipe('a', T1)], [{ id: 'a', deletedAt: T2 }]);
    expect(result.removals).toEqual(['a']);
    expect(result.upserts).toEqual([]);
  });

  it('garde l’enregistrement quand sa réapparition est postérieure à sa suppression', () => {
    const result = mergeIncoming([], [recipe('a', T3)], [{ id: 'a', deletedAt: T2 }]);
    expect(result.upserts.map((r) => r.id)).toEqual(['a']);
    expect(result.removals).toEqual([]);
  });
});

describe('acceptsIncoming', () => {
  it('accepte ce que le serveur ne connaît pas', () => {
    expect(acceptsIncoming(undefined, { updatedAt: T1 })).toBe(true);
  });

  it('n’accepte que du strictement plus récent', () => {
    expect(acceptsIncoming({ updatedAt: T1 }, { updatedAt: T2 })).toBe(true);
    expect(acceptsIncoming({ updatedAt: T2 }, { updatedAt: T1 })).toBe(false);
    expect(acceptsIncoming({ updatedAt: T2 }, { updatedAt: T2 })).toBe(false);
  });
});

describe('requestSince', () => {
  const at = '2026-09-30T08:00:00.000Z';

  it('reprend depuis le dernier échange quand l’appareil connaissait déjà toutes les collections', () => {
    expect(requestSince(at, [...SYNCABLE_COLLECTIONS])).toBe(at);
  });

  it('redemande tout quand une collection est apparue depuis', () => {
    expect(requestSince(at, ['deVerbs'], ['deVerbs', 'enPhrasals'])).toBeNull();
  });

  it('redemande tout quand rien n’a été retenu, comme avant cette règle', () => {
    expect(requestSince(at, undefined)).toBeNull();
  });

  it('demande tout au premier échange', () => {
    expect(requestSince(null, [...SYNCABLE_COLLECTIONS])).toBeNull();
  });
});
