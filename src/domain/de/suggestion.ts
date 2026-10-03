/**
 * Remet en forme le verbe allemand que propose une traduction automatique
 * depuis le français, avant de le chercher dans le dictionnaire.
 *
 * DeepL rend parfois une forme qui n'est pas un infinitif nu : « zu fahren »,
 * « Fahren » (le nom), « fahren. ». Rien de plus n'est deviné : ce qui ne
 * se retrouve pas ensuite dans le dictionnaire n'est pas proposé.
 */
export function cleanGermanSuggestion(raw: string): string {
  let text = raw
    .trim()
    .replace(/^["'«»„“”‚‘’\s]+|["'«»„“”‚‘’\s]+$/g, '')
    .replace(/[.!?;,:]+$/g, '')
    .trim();
  text = text.replace(/^zu\s+/i, '');
  // « sich zu freuen » → « sich freuen »
  text = text.replace(/^sich\s+zu\s+/i, 'sich ');
  return text;
}
