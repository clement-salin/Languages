import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openSyncStore } from '../server/sync-store';

function freshStore() {
  return openSyncStore(join(mkdtempSync(join(tmpdir(), 'sync-store-')), 'test.db'));
}

const verb = (id: string, updatedAt: string) => ({ id, updatedAt, translation: '' });
const T1 = '2026-10-01T10:00:00.000Z';
const T2 = '2026-10-01T11:00:00.000Z';

describe('magasin de synchronisation', () => {
  it('transmet au second appareil ce que le premier a envoyé', () => {
    const store = freshStore();
    store.exchange(null, { deVerbs: { changes: [verb('fahren', T1)], deletions: [] } });
    const { collections } = store.exchange(null, {});
    expect(collections.deVerbs?.changes.map((r) => r.id)).toEqual(['fahren']);
    expect(collections.enPhrasals?.changes).toEqual([]);
  });

  it('garde la version la plus récente', () => {
    const store = freshStore();
    store.exchange(null, { deVerbs: { changes: [verb('fahren', T2)], deletions: [] } });
    const older = { ...verb('fahren', T1), translation: 'ancienne' };
    store.exchange(null, { deVerbs: { changes: [older], deletions: [] } });
    const [stored] = store.exchange(null, {}).collections.deVerbs!.changes;
    expect(stored!.updatedAt).toBe(T2);
  });

  it('propage une suppression postérieure, et pas une antérieure', () => {
    const store = freshStore();
    store.exchange(null, {
      enPhrasals: { changes: [verb('sit down', T1), verb('get up', T2)], deletions: [] },
    });
    const { now } = store.exchange(null, {
      enPhrasals: {
        changes: [],
        deletions: [{ id: 'sit down', deletedAt: T2 }, { id: 'get up', deletedAt: T1 }],
      },
    });
    const all = store.exchange(null, {}).collections.enPhrasals!;
    expect(all.changes.map((r) => r.id)).toEqual(['get up']);
    expect(all.deletions.map((t) => t.id).sort()).toEqual(['get up', 'sit down']);
    // Un appareil déjà à jour ne reçoit plus rien.
    expect(store.exchange(now, {}).collections.enPhrasals).toEqual({ changes: [], deletions: [] });
  });

  it('date chaque échange d’une heure strictement croissante', () => {
    const store = freshStore();
    let previous = '';
    for (let i = 0; i < 50; i++) {
      const { now } = store.exchange(null, {});
      expect(now > previous).toBe(true);
      previous = now;
    }
  });
});
