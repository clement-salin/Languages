/**
 * Traduction par DeepL, pour proposer un sens en français.
 *
 * Le navigateur ne peut pas appeler DeepL lui-même : la clé d'API y serait
 * lisible par n'importe qui. Il passe donc par /api/translate, et c'est le
 * serveur qui détient la clé (DEEPL_API_KEY, dans le .env du VPS).
 *
 * N'utilise que `fetch` : aucune dépendance, comme le reste du serveur.
 */

export const TRANSLATE_ROUTE = '/api/translate';

export type Lang = 'DE' | 'EN' | 'FR';

export interface TranslateRequest {
  text: string;
  source: Lang;
  target: Lang;
}

/**
 * Les sens de traduction utiles au carnet : allemand et anglais vers le
 * français (proposer un sens), et français vers l'allemand (retrouver un
 * verbe dont on ne connaît que la traduction).
 */
const PAIRS = new Set(['DE>FR', 'EN>FR', 'FR>DE']);

export interface TranslateResult {
  status: number;
  body: { translation: string } | { error: string };
}

/** Une saisie, pas un texte : au-delà, c'est une erreur ou un abus. */
const MAX_LENGTH = 200;

/** Valide le corps de la requête ; rend un message d'erreur sinon. */
export function parseTranslateRequest(body: unknown): TranslateRequest | string {
  if (!body || typeof body !== 'object') return 'Corps de requête illisible.';
  const { text, source } = body as Record<string, unknown>;
  // Sans cible, le français : c'était le seul sens avant FR → DE.
  const target = (body as Record<string, unknown>).target ?? 'FR';
  if (!PAIRS.has(`${String(source)}>${String(target)}`)) return 'Sens de traduction non pris en charge.';
  if (typeof text !== 'string' || text.trim() === '') return 'Rien à traduire.';
  if (text.length > MAX_LENGTH) return `Texte trop long (${MAX_LENGTH} caractères au plus).`;
  return { text: text.trim(), source: source as Lang, target: target as Lang };
}

/** Les clés gratuites se terminent par « :fx » et ont leur propre adresse. */
export function deeplEndpoint(apiKey: string): string {
  return apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
}

export async function translate(
  request: TranslateRequest,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TranslateResult> {
  if (apiKey === '') {
    return { status: 503, body: { error: "La traduction n'est pas configurée sur le serveur (DEEPL_API_KEY absent)." } };
  }

  let response: Response;
  try {
    response = await fetchImpl(deeplEndpoint(apiKey), {
      method: 'POST',
      headers: { authorization: `DeepL-Auth-Key ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: [request.text], source_lang: request.source, target_lang: request.target }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { status: 502, body: { error: 'DeepL injoignable. Réessaie dans un instant.' } };
  }

  if (response.status === 456) {
    return { status: 429, body: { error: 'Quota DeepL du mois atteint.' } };
  }
  if (response.status === 401 || response.status === 403) {
    return { status: 502, body: { error: 'Clé DeepL refusée : vérifie DEEPL_API_KEY sur le serveur.' } };
  }
  if (response.status === 429) {
    return { status: 429, body: { error: 'Trop de demandes à DeepL. Réessaie dans un instant.' } };
  }
  if (!response.ok) {
    return { status: 502, body: { error: `DeepL a répondu ${response.status}.` } };
  }

  const data = (await response.json().catch(() => null)) as { translations?: { text?: unknown }[] } | null;
  const translation = data?.translations?.[0]?.text;
  if (typeof translation !== 'string' || translation.trim() === '') {
    return { status: 502, body: { error: 'Réponse de DeepL inattendue.' } };
  }
  return { status: 200, body: { translation: translation.trim() } };
}
