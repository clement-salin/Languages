import { describe, expect, it } from 'vitest';
import { deeplEndpoint, parseTranslateRequest, translate } from '../server/translate';

function fakeFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit } = {}): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    seen.url = url;
    seen.init = init;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe('requête de traduction', () => {
  it('accepte un texte allemand ou anglais', () => {
    expect(parseTranslateRequest({ text: ' to sit up ', source: 'EN' })).toEqual({ text: 'to sit up', source: 'EN' });
  });

  it('refuse le reste', () => {
    expect(parseTranslateRequest({ text: 'x', source: 'IT' })).toBeTypeOf('string');
    expect(parseTranslateRequest({ text: '   ', source: 'DE' })).toBeTypeOf('string');
    expect(parseTranslateRequest({ text: 'a'.repeat(201), source: 'DE' })).toBeTypeOf('string');
    expect(parseTranslateRequest(null)).toBeTypeOf('string');
  });
});

describe('appel à DeepL', () => {
  it('vise l’adresse gratuite pour une clé « :fx »', () => {
    expect(deeplEndpoint('abc:fx')).toBe('https://api-free.deepl.com/v2/translate');
    expect(deeplEndpoint('abc')).toBe('https://api.deepl.com/v2/translate');
  });

  it('envoie la clé en en-tête et rend la traduction', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const result = await translate(
      { text: 'fahren', source: 'DE' },
      'secret:fx',
      fakeFetch(200, { translations: [{ text: 'conduire' }] }, seen),
    );
    expect(result).toEqual({ status: 200, body: { translation: 'conduire' } });
    expect((seen.init?.headers as Record<string, string>).authorization).toBe('DeepL-Auth-Key secret:fx');
    expect(JSON.parse(String(seen.init?.body))).toEqual({ text: ['fahren'], source_lang: 'DE', target_lang: 'FR' });
  });

  it('dit clairement quand elle n’est pas configurée ou que le quota est atteint', async () => {
    expect((await translate({ text: 'x', source: 'EN' }, '')).status).toBe(503);
    const quota = await translate({ text: 'x', source: 'EN' }, 'k', fakeFetch(456, {}));
    expect(quota).toEqual({ status: 429, body: { error: 'Quota DeepL du mois atteint.' } });
    expect((await translate({ text: 'x', source: 'EN' }, 'k', fakeFetch(403, {}))).status).toBe(502);
  });

  it('ne rend pas une traduction vide', async () => {
    const result = await translate({ text: 'x', source: 'EN' }, 'k', fakeFetch(200, { translations: [] }));
    expect(result.status).toBe(502);
  });
});
