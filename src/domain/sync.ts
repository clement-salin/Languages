/**
 * Protocole de synchronisation entre le navigateur et le serveur.
 *
 * Repris de batch-cooking (src/domain/sync.ts), seule la liste des
 * collections diffère : garder les deux fichiers alignés.
 *
 * Module pur : ni React, ni réseau, ni base. Il est partagé par le client et
 * le serveur, qui doivent appliquer exactement la même règle d'arbitrage —
 * sinon les deux côtés divergent sans jamais converger.
 *
 * Modèle retenu : **local-first**. Le navigateur fait foi, le serveur est un
 * point de rendez-vous entre appareils. On pousse ce qui a changé localement,
 * on tire ce qui a changé ailleurs, et on recommence. Rien n'exige d'être en
 * ligne pour utiliser l'app.
 *
 * Arbitrage : **le dernier écrit gagne**, comparé sur `updatedAt`. C'est
 * suffisant pour un usage solo — un même utilisateur modifie rarement la même
 * fiche sur deux appareils dans la même minute. Un vrai arbitrage par champ
 * coûterait beaucoup plus cher pour un gain nul ici.
 */

/**
 * Tout ce qui se synchronise porte au moins ces deux champs. Le protocole
 * n'a pas besoin d'en savoir plus : il compare des dates et transporte du
 * JSON.
 */
export interface Syncable {
  id: string;
  updatedAt: string;
}

/**
 * Les collections synchronisées. En ajouter une se fait ici, puis dans le
 * client et dans le magasin serveur — qui, eux, sont génériques.
 */
export const SYNCABLE_COLLECTIONS = ['deVerbs', 'enPhrasals', 'enExpressions'] as const;
export type SyncableCollection = (typeof SYNCABLE_COLLECTIONS)[number];

/** Trace d'une suppression, pour qu'elle se propage comme une modification. */
export interface Tombstone {
  id: string;
  deletedAt: string;
}

export interface CollectionPayload<T extends Syncable = Syncable> {
  changes: T[];
  deletions: Tombstone[];
}

export type Collections<T extends Syncable = Syncable> = Partial<
  Record<SyncableCollection, CollectionPayload<T>>
>;

export interface SyncRequest {
  /** Date du dernier échange réussi ; `null` au tout premier. */
  since: string | null;
  collections: Collections;
}

export interface SyncResponse {
  /** Horloge du serveur, à conserver comme `since` du prochain échange. */
  now: string;
  collections: Collections;
}

/** Ce que le client doit appliquer localement après un échange. */
export interface MergeResult<T extends Syncable = Syncable> {
  upserts: T[];
  removals: string[];
}

/**
 * Depuis quand demander au serveur ce qui a changé.
 *
 * Une seule date sert à toutes les collections. Or un appareil encore sur
 * l'ancienne version de l'app reçoit une collection qu'il ne connaît pas,
 * l'ignore, et retient quand même la date de l'échange : une fois à jour,
 * il ne redemanderait plus ce que cette collection contenait déjà. C'est
 * arrivé dans batch-cooking à une collection ajoutée après coup.
 *
 * L'appareil retient donc aussi les collections qu'il connaissait à la
 * date retenue. S'il en connaît une de plus aujourd'hui — ou si rien n'a
 * été retenu, comme avant cette règle —, il redemande tout, une fois.
 * Sans risque : l'arbitrage garde la version la plus récente de chaque
 * enregistrement, comme pour un nouvel appareil.
 */
export function requestSince(
  lastSyncAt: string | null,
  knownCollections: readonly string[] | undefined,
  collections: readonly string[] = SYNCABLE_COLLECTIONS,
): string | null {
  if (lastSyncAt === null || knownCollections === undefined) return null;
  return collections.every((collection) => knownCollections.includes(collection)) ? lastSyncAt : null;
}

/**
 * Ce qu'il faut envoyer : tout ce qui a bougé depuis le dernier échange.
 *
 * `since` vaut `null` au premier échange, et tout part alors — c'est ce qui
 * permet à un second appareil de récupérer un carnet existant.
 */
export function selectOutgoing<T extends Syncable>(
  local: T[],
  tombstones: Tombstone[],
  since: string | null,
): CollectionPayload<T> {
  if (since === null) return { changes: local, deletions: tombstones };
  return {
    changes: local.filter((record) => record.updatedAt > since),
    deletions: tombstones.filter((tombstone) => tombstone.deletedAt > since),
  };
}

/**
 * Ce qu'il faut appliquer : les versions distantes plus récentes que les
 * locales, et les suppressions plus récentes que l'enregistrement qu'elles visent.
 *
 * Un enregistrement modifié localement *après* une suppression distante survit :
 * l'utilisateur l'a manifestement voulu de nouveau.
 */
export function mergeIncoming<T extends Syncable>(
  local: T[],
  incoming: T[],
  deletions: Tombstone[],
): MergeResult<T> {
  const byId = new Map(local.map((record) => [record.id, record]));

  const upserts = incoming.filter((remote) => {
    const mine = byId.get(remote.id);
    return mine === undefined || remote.updatedAt > mine.updatedAt;
  });

  // Ce que l'on vient d'accepter compte comme local pour la suite.
  for (const record of upserts) byId.set(record.id, record);

  const removals = deletions
    .filter((tombstone) => {
      const mine = byId.get(tombstone.id);
      return mine !== undefined && tombstone.deletedAt > mine.updatedAt;
    })
    .map((tombstone) => tombstone.id);

  return { upserts: upserts.filter((record) => !removals.includes(record.id)), removals };
}

/**
 * Même règle, côté serveur : il ne retient une version entrante que si elle
 * est plus récente que celle qu'il détient.
 */
export function acceptsIncoming(
  stored: { updatedAt: string } | undefined,
  incoming: { updatedAt: string },
): boolean {
  return stored === undefined || incoming.updatedAt > stored.updatedAt;
}
