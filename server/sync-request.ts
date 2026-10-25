/**
 * Validation d'une demande de synchronisation, avant qu'elle touche la base.
 *
 * Le serveur ne comprend pas les fiches qu'il transporte (voir
 * sync-store.ts), mais il lit leur identifiant et leur date : ces deux
 * champs-là doivent être ce qu'on attend. Sans ce contrôle, une demande mal
 * formée échouait au milieu de la transaction (erreur 500).
 */

import type { Collections, SyncRequest } from '../src/domain/sync.ts';
import { SYNCABLE_COLLECTIONS } from '../src/domain/sync.ts';

/** Au-delà, ce n'est plus un identifiant (un infinitif, une expression) mais une erreur ou un abus. */
const MAX_ID_LENGTH = 300;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isDate = (x: unknown): x is string => typeof x === 'string' && x.length <= 40 && !Number.isNaN(Date.parse(x));
const isId = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '' && x.length <= MAX_ID_LENGTH;

/** Rend la demande validée, ou le message d'erreur à renvoyer (400). */
export function parseSyncRequest(body: unknown): SyncRequest | string {
  if (!isRecord(body) || !isRecord(body['collections'])) return 'Corps de requête incomplet.';
  const since = body['since'] ?? null;
  if (since !== null && !isDate(since)) return 'Date de dernier échange illisible.';

  const collections: Collections = {};
  for (const name of SYNCABLE_COLLECTIONS) {
    const payload = body['collections'][name];
    if (payload === undefined) continue;
    if (!isRecord(payload)) return `Collection ${name} illisible.`;
    const changes = payload['changes'] ?? [];
    const deletions = payload['deletions'] ?? [];
    if (!Array.isArray(changes) || !Array.isArray(deletions)) return `Collection ${name} illisible.`;
    for (const record of changes) {
      if (!isRecord(record) || !isId(record['id']) || !isDate(record['updatedAt'])) {
        return `Fiche illisible dans ${name}.`;
      }
    }
    for (const tombstone of deletions) {
      if (!isRecord(tombstone) || !isId(tombstone['id']) || !isDate(tombstone['deletedAt'])) {
        return `Suppression illisible dans ${name}.`;
      }
    }
    collections[name] = { changes, deletions } as NonNullable<Collections[typeof name]>;
  }
  return { since, collections };
}
