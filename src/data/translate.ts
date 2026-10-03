/** Suggestion de traduction : passe par le serveur, qui détient la clé DeepL. */

import { readToken } from './sync';

export type SourceLang = 'DE' | 'EN';

export class TranslateError extends Error {}

/** La suggestion n'existe que pour un appareil relié au serveur (jeton enregistré). */
export function canTranslate(): boolean {
  return readToken() !== '';
}

export async function suggestTranslation(text: string, source: SourceLang): Promise<string> {
  if (!navigator.onLine) throw new TranslateError('Hors ligne : la suggestion demande le réseau.');
  let response: Response;
  try {
    response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${readToken()}` },
      body: JSON.stringify({ text, source }),
    });
  } catch {
    throw new TranslateError('Serveur injoignable.');
  }
  const payload = (await response.json().catch(() => null)) as { translation?: string; error?: string } | null;
  if (!response.ok || typeof payload?.translation !== 'string') {
    throw new TranslateError(payload?.error ?? `Le serveur a répondu ${response.status}.`);
  }
  return payload.translation;
}
