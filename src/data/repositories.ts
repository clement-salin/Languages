import type { Syncable, SyncableCollection } from '../domain/sync';
import type { CollectionRepository } from './collection';
import { deVerbs } from './de-verbs';
import { enExpressions } from './en-expressions';
import { enPhrasals } from './en-phrasals';

/** Le dépôt de chaque collection, pour qui n'a besoin que de la compter ou de la lister. */
export const REPOSITORIES: Record<SyncableCollection, CollectionRepository<Syncable>> = {
  deVerbs,
  enPhrasals,
  enExpressions,
};
