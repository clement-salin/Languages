/** Accès aux données depuis les composants React. */

import { useEffect, useState } from 'react';
import type { Syncable, SyncableCollection } from '../domain/sync';
import type { CollectionRepository } from './collection';
import { onChange } from './events';
import { loadLexicon, type Lexicon } from './lexicon';
import { getSyncState, onSyncState, type SyncState } from './sync';

/** Contenu d'une collection, relu à chaque modification (locale ou synchronisée). `null` pendant le chargement. */
export function useCollection<T extends Syncable>(
  repository: CollectionRepository<T>,
  collection: SyncableCollection,
): T[] | null {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void repository.all().then((all) => {
        if (alive) setItems(all);
      });
    };
    load();
    const stop = onChange((changed) => {
      if (changed === collection) load();
    });
    return () => {
      alive = false;
      stop();
    };
  }, [repository, collection]);
  return items;
}

let lexiconPromise: Promise<Lexicon> | undefined;

/**
 * Le dictionnaire allemand (~5 Mo), chargé une seule fois, et seulement
 * quand une page allemande le demande : ouvrir l'app sur l'anglais ne le
 * télécharge pas.
 */
export function useLexicon(): { lexicon: Lexicon | null; error: string | null; retry: () => void } {
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    lexiconPromise ??= loadLexicon();
    lexiconPromise.then(
      (loaded) => alive && setLexicon(loaded),
      (failure: unknown) => {
        lexiconPromise = undefined;
        if (alive) setError(String(failure));
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);
  return {
    lexicon,
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}

export function useSyncState(): SyncState {
  const [state, setState] = useState(getSyncState);
  useEffect(() => onSyncState(setState), []);
  return state;
}
