import { Link, NavLink, useLocation } from 'react-router-dom';
import { LANG_LABELS, lastLang, lastPath, type Lang } from '../language';
import { Flag } from './Flag';
import { SettingsIcon } from './icons';
import { SECTIONS } from './sections';

/**
 * Barre d'onglets du téléphone, sous le pouce : toute la navigation en un
 * seul endroit.
 *
 * - les sections de la langue courante ;
 * - **la bascule de langue, réduite à un onglet** : le drapeau de l'autre
 *   langue, qui ramène là où on l'avait laissée ;
 * - les réglages (synchronisation, sauvegarde).
 *
 * Sur la page des réglages, qui n'appartient à aucune langue, la barre
 * garde les sections de la dernière langue ouverte : elle ne change pas de
 * forme sous le doigt.
 */
export function TabBar({ lang }: { lang: Lang | null }) {
  const { pathname } = useLocation();
  const current = lang ?? lastLang();
  const other: Lang = current === 'de' ? 'en' : 'de';
  const tab = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight no-underline';

  return (
    <nav
      aria-label="Navigation"
      data-lang={current}
      className="fixed inset-x-0 bottom-0 z-10 flex h-[var(--tab-bar-height)] border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {SECTIONS[current].map((section) => {
        const active = lang !== null && section.matches(pathname);
        const SectionIcon = section.icon;
        return (
          <Link
            key={section.to}
            to={section.to}
            aria-current={active ? 'page' : undefined}
            className={`${tab} ${active ? 'font-semibold text-accent-text' : 'font-medium text-ink-soft'}`}
          >
            <SectionIcon size={24} />
            <span className="max-w-full truncate">{section.label}</span>
          </Link>
        );
      })}
      <Link to={lastPath(other)} aria-label={`Passer à : ${LANG_LABELS[other].native}`} className={`${tab} font-medium text-ink-soft`}>
        <span className="flex h-6 items-center">
          <Flag lang={other} size="large" />
        </span>
        <span>{LANG_LABELS[other].native}</span>
      </Link>
      <NavLink
        to="/reglages"
        className={({ isActive }) => `${tab} ${isActive ? 'font-semibold text-ink' : 'font-medium text-ink-soft'}`}
      >
        <SettingsIcon size={24} />
        <span>Réglages</span>
      </NavLink>
    </nav>
  );
}
