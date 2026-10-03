/**
 * Moteur de synchronisation, côté navigateur. Repris de batch-cooking.
 *
 * Un échange = un aller-retour : on envoie ce qui a changé localement depuis
 * la dernière fois, le serveur répond avec ce qui a changé ailleurs, on
 * applique. L'arbitrage vit dans `src/domain/sync.ts`, partagé avec le
 * serveur pour que les deux côtés appliquent la même règle.
 *
 * Le jeton est propre à chaque appareil : il est saisi une fois et rangé
 * dans le navigateur, jamais dans le dépôt ni dans la base.
 */

import {
  SYNCABLE_COLLECTIONS,
  mergeIncoming,
  selectOutgoing,
  type Collections,
  type MergeResult,
  type Syncable,
  type SyncableCollection,
  type SyncResponse,
} from '../domain/sync';
import { emitChange, onChange } from './events';
import { syncSource } from './sync-source';

const ENDPOINT = '/api/sync';
const TOKEN_KEY = 'languages.sync-token';

export class SyncError extends Error {}

export interface SyncOutcome {
  sent: number;
  received: number;
  removed: number;
  at: string;
}

/** Le stockage du navigateur peut être indisponible (navigation privée). */
export function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeToken(token: string): void {
  try {
    if (token.trim() === '') localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token.trim());
  } catch {
    // Sans stockage, la synchronisation ne tiendra pas d'une session à
    // l'autre ; ce n'est pas une raison de faire échouer la saisie.
  }
}

function outgoingFor(
  snapshot: Awaited<ReturnType<typeof syncSource.snapshot>>,
  since: string | null,
): Collections {
  const collections: Collections = {};
  for (const collection of SYNCABLE_COLLECTIONS) {
    const { records, tombstones } = snapshot[collection];
    collections[collection] = selectOutgoing(records, tombstones, since);
  }
  return collections;
}

function total(collections: Collections): number {
  return Object.values(collections).reduce(
    (sum, payload) => sum + payload.changes.length + payload.deletions.length,
    0,
  );
}

export async function pendingCount(): Promise<number> {
  const [snapshot, since] = await Promise.all([
    syncSource.snapshot(),
    syncSource.lastSyncAt(),
  ]);
  return total(outgoingFor(snapshot, since));
}

export async function synchronize(): Promise<SyncOutcome> {
  const token = readToken();
  if (token === '') throw new SyncError("Aucun jeton de synchronisation n'est enregistré.");

  const [snapshot, since, requested] = await Promise.all([
    syncSource.snapshot(),
    syncSource.lastSyncAt(),
    syncSource.requestSince(),
  ]);
  // Envoyer ce qui a changé ici depuis le dernier échange ; demander depuis
  // `requested`, qui vaut « tout » si une collection est nouvelle ici.
  const outgoing = outgoingFor(snapshot, since);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ since: requested, collections: outgoing }),
    });
  } catch {
    throw new SyncError('Serveur injoignable. Les modifications restent enregistrées ici.');
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Le serveur a répondu ${response.status}.`;
    throw new SyncError(message);
  }

  const result = payload as SyncResponse;
  const merged = {} as Record<SyncableCollection, MergeResult<Syncable>>;
  let received = 0;
  let removed = 0;
  for (const collection of SYNCABLE_COLLECTIONS) {
    const incoming = result.collections?.[collection];
    merged[collection] = mergeIncoming(
      snapshot[collection].records,
      incoming?.changes ?? [],
      incoming?.deletions ?? [],
    );
    received += merged[collection].upserts.length;
    removed += merged[collection].removals.length;
  }
  await syncSource.apply(merged, result.now);
  for (const collection of SYNCABLE_COLLECTIONS) {
    if (merged[collection].upserts.length > 0 || merged[collection].removals.length > 0) {
      emitChange(collection, 'sync');
    }
  }

  return { sent: total(outgoing), received, removed, at: result.now };
}

/* ------------------------------------------------------------------ */
/* Déclenchement automatique                                           */
/* ------------------------------------------------------------------ */

/** Ce que l'interface affiche de la synchronisation. */
export interface SyncState {
  running: boolean;
  lastAt: string | null;
  lastError: string | null;
}

type StateListener = (state: SyncState) => void;
const stateListeners = new Set<StateListener>();
let state: SyncState = { running: false, lastAt: null, lastError: null };
let timer: ReturnType<typeof setTimeout> | undefined;

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const listener of stateListeners) listener(state);
}

export function getSyncState(): SyncState {
  return state;
}

export function onSyncState(listener: StateListener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** Un échange demandé à la main : l'erreur remonte, pour être affichée. */
export async function syncNow(): Promise<SyncOutcome> {
  clearTimeout(timer);
  setState({ running: true });
  try {
    const outcome = await synchronize();
    setState({ running: false, lastAt: outcome.at, lastError: null });
    return outcome;
  } catch (error) {
    setState({ running: false, lastError: (error as Error).message });
    throw error;
  }
}

/**
 * Programme un échange après une accalmie.
 *
 * Sans ce délai, chaque touche frappée dans une note déclencherait un échange.
 * Un échec est silencieux : c'est le propre du local-first, le travail est
 * déjà enregistré et le prochain essai repartira du même point.
 */
export function scheduleSync(delayMs = 2000): void {
  if (readToken() === '') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    void syncNow().catch(() => undefined);
  }, delayMs);
}

/**
 * Les deux déclenchements qui ne découlent pas d'une écriture locale.
 *
 * Sans eux, l'app ne s'échangerait qu'au lancement et après chaque
 * modification — et une app déjà ouverte en arrière-plan ne se relance pas :
 * l'iPhone resté ouvert depuis le matin afficherait le carnet d'avant.
 *
 * - **Retour dans l'app** : iOS conserve souvent la page en mémoire, donc
 *   `main.tsx` ne rejoue pas. C'est `visibilitychange` qui le signale.
 * - **Retour du réseau** : l'échange repart sans rien demander.
 *
 * Le délai est court — on veut que rouvrir l'app paraisse immédiat — mais
 * non nul : `scheduleSync` regroupe, donc revenir dans l'app juste après
 * avoir modifié une fiche ne produit qu'un seul échange.
 *
 * S'y ajoute un échange après chaque écriture locale, regroupé lui aussi.
 */
export function startAutoSync(): () => void {
  const stopChanges = onChange((_collection, origin) => {
    if (origin === 'local') scheduleSync();
  });
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') scheduleSync(300);
  };
  const onOnline = (): void => scheduleSync(300);

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);

  return () => {
    stopChanges();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}
