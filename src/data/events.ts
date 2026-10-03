import type { SyncableCollection } from '../domain/sync';

/**
 * Prévient l'interface qu'une collection a changé.
 *
 * `origin` distingue une écriture faite ici (qui doit partir vers le
 * serveur) de ce qu'un échange vient d'apporter (qu'il ne faut pas renvoyer).
 */
export type ChangeOrigin = 'local' | 'sync';
type Listener = (collection: SyncableCollection, origin: ChangeOrigin) => void;

const listeners = new Set<Listener>();

export function emitChange(collection: SyncableCollection, origin: ChangeOrigin): void {
  for (const listener of listeners) listener(collection, origin);
}

export function onChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
