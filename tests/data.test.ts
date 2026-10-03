import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, useFreshDatabaseForTests } from '../src/data/db';
import { addVerb, deVerbs, updateVerb } from '../src/data/de-verbs';
import { addPhrasal, enPhrasals } from '../src/data/en-phrasals';
import { LEGACY_BACKUP_KEY, LEGACY_KEY, migrateLegacyVerbs } from '../src/data/legacy-migration';
import { syncSource } from '../src/data/sync-source';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

let n = 0;
beforeEach(async () => {
  await useFreshDatabaseForTests(`test-${++n}`);
});

const legacy = JSON.stringify({
  version: 1,
  verbs: [
    { id: 'fahren', translation: 'conduire', notes: '', addedAt: '2026-09-01T10:00:00.000Z', auxiliary: 'sein' },
    { id: 'sich freuen', translation: '', notes: 'n', addedAt: '2026-09-02T10:00:00.000Z' },
    { pas: 'un verbe' },
  ],
});

describe('reprise des verbes de Verbheft', () => {
  it('copie les verbes, puis met l’ancienne copie de côté', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEY, legacy);
    expect(await migrateLegacyVerbs(storage)).toBe(2);
    const fahren = await deVerbs.get('fahren');
    expect(fahren).toMatchObject({ translation: 'conduire', auxiliary: 'sein', updatedAt: '2026-09-01T10:00:00.000Z' });
    expect(storage.getItem(LEGACY_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(legacy);
  });

  it('ne se rejoue pas : un verbe supprimé depuis ne revient pas', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEY, legacy);
    await migrateLegacyVerbs(storage);
    await deVerbs.remove('fahren');
    storage.setItem(LEGACY_KEY, legacy);
    expect(await migrateLegacyVerbs(storage)).toBe(0);
    expect(await deVerbs.get('fahren')).toBeUndefined();
  });

  it('n’écrase pas un verbe déjà présent', async () => {
    await addVerb({ id: 'fahren', translation: 'rouler' });
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEY, legacy);
    expect(await migrateLegacyVerbs(storage)).toBe(1);
    expect((await deVerbs.get('fahren'))?.translation).toBe('rouler');
  });

  it('ne fait rien sans ancien carnet', async () => {
    expect(await migrateLegacyVerbs(new MemoryStorage())).toBe(0);
    expect(await deVerbs.all()).toEqual([]);
  });
});

describe('dépôts', () => {
  it('n’ajoute pas deux fois le même verbe', async () => {
    expect(await addVerb({ id: 'fahren' })).toBe(true);
    expect(await addVerb({ id: 'fahren' })).toBe(false);
  });

  it('efface un choix remis à sa valeur par défaut', async () => {
    await addVerb({ id: 'fahren', auxiliary: 'haben' });
    await updateVerb('fahren', { auxiliary: undefined });
    expect(await deVerbs.get('fahren')).not.toHaveProperty('auxiliary');
  });

  it('laisse une trace à la suppression, et la retire si l’on recrée', async () => {
    await addPhrasal({ base: 'sit', particle: 'down', meaning: 's’asseoir' });
    await enPhrasals.remove('sit down');
    let snapshot = await syncSource.snapshot();
    expect(snapshot.enPhrasals.tombstones.map((t) => t.id)).toEqual(['sit down']);
    await addPhrasal({ base: 'sit', particle: 'down', meaning: 's’asseoir' });
    snapshot = await syncSource.snapshot();
    expect(snapshot.enPhrasals.tombstones).toEqual([]);
  });
});

describe('application d’un échange', () => {
  it('écrit ce qui arrive, retient la date et oublie les traces transmises', async () => {
    await addVerb({ id: 'gehen' });
    await deVerbs.remove('gehen');
    const now = new Date(Date.now() + 1000).toISOString();
    await syncSource.apply(
      {
        deVerbs: {
          upserts: [{ id: 'fahren', translation: '', notes: '', addedAt: now, updatedAt: now } as never],
          removals: [],
        },
        enPhrasals: { upserts: [], removals: [] },
      },
      now,
    );
    expect((await deVerbs.get('fahren'))?.updatedAt).toBe(now);
    expect(await syncSource.lastSyncAt()).toBe(now);
    expect(await syncSource.requestSince()).toBe(now);
    expect((await syncSource.snapshot()).deVerbs.tombstones).toEqual([]);
    expect(await (await db()).get('meta', 'sync')).toMatchObject({ collections: ['deVerbs', 'enPhrasals'] });
  });
});
