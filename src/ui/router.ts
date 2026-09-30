/** Navigation par ancre (#/ et #/verbe/<infinitif>), compatible GitHub Pages. */
export type Route = { name: 'list' } | { name: 'verb'; id: string };

export function verbHref(id: string): string {
  return `#/verbe/${encodeURIComponent(id)}`;
}

export function currentRoute(): Route {
  const match = location.hash.match(/^#\/verbe\/(.+)$/);
  if (match) {
    try {
      return { name: 'verb', id: decodeURIComponent(match[1]) };
    } catch {
      // ancre mal formée : retour à la liste
    }
  }
  return { name: 'list' };
}
