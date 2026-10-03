/** Les deux parties de l'app, et ce qu'on retient de chacune. */

export type Lang = 'de' | 'en';

export const LANGS: Lang[] = ['de', 'en'];

export const LANG_LABELS: Record<Lang, { native: string; french: string }> = {
  de: { native: 'Deutsch', french: 'Allemand' },
  en: { native: 'English', french: 'Anglais' },
};

export function langFromPath(pathname: string): Lang | null {
  const first = pathname.split('/')[1];
  return first === 'de' || first === 'en' ? first : null;
}

const LAST_PATH_KEY = (lang: Lang) => `languages.last-path.${lang}`;
const LAST_LANG_KEY = 'languages.last-lang';

/**
 * Basculer de langue ramène où l'on en était dans l'autre : dernière section
 * et dernière fiche ouvertes. Retenu dans le navigateur, propre à chaque
 * appareil — ce n'est pas une donnée du carnet.
 */
export function rememberPath(pathname: string): void {
  const lang = langFromPath(pathname);
  if (!lang) return;
  try {
    localStorage.setItem(LAST_PATH_KEY(lang), pathname);
    localStorage.setItem(LAST_LANG_KEY, lang);
  } catch {
    // Navigation privée : la bascule ramènera à l'accueil de la langue.
  }
}

export function lastPath(lang: Lang): string {
  try {
    const saved = localStorage.getItem(LAST_PATH_KEY(lang));
    if (saved && langFromPath(saved) === lang) return saved;
  } catch {
    // idem
  }
  return `/${lang}`;
}

export function lastLang(): Lang {
  try {
    const saved = localStorage.getItem(LAST_LANG_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch {
    // idem
  }
  return 'de';
}
