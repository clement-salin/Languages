import { Link } from 'react-router-dom';
import { LANG_LABELS, LANGS, lastPath, type Lang } from '../language';
import { Flag } from './Flag';

/**
 * Bascule entre les deux langues.
 *
 * En tête de barre latérale, sur grand écran ; sur téléphone, la bascule
 * est un onglet de la barre du bas (`TabBar`). Chaque lien ramène à la
 * dernière page vue dans l'autre langue.
 *
 * Les couleurs d'accent sont écrites ici en dur, et c'est voulu : la
 * bascule montre les **deux** langues à la fois, alors que les jetons
 * `accent` ne valent que pour la langue courante.
 */
const ACTIVE: Record<Lang, { fill: string; text: string }> = {
  de: { fill: 'bg-[#a33a2c]', text: 'text-[#8a2e22]' },
  en: { fill: 'bg-[#2a5a94]', text: 'text-[#204a7a]' },
};

export function LanguageSwitch({ current }: { current: Lang | null }) {
  return (
    <nav aria-label="Langue" className="grid grid-cols-2 gap-1 rounded-xl bg-track p-1">
      {LANGS.map((lang) => {
        const active = lang === current;
        return (
          <Link
            key={lang}
            to={lastPath(lang)}
            aria-current={active ? 'page' : undefined}
            className={`flex h-10 items-center justify-center gap-2 rounded-[9px] text-sm no-underline ${
              active ? `bg-surface font-semibold shadow-sm ${ACTIVE[lang].text}` : 'font-medium text-ink-3 hover:text-ink'
            }`}
          >
            <Flag lang={lang} />
            {LANG_LABELS[lang].native}
          </Link>
        );
      })}
    </nav>
  );
}
