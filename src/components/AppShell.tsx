import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCollection, useSyncState } from '../data/hooks';
import { REPOSITORIES } from '../data/repositories';
import { readToken } from '../data/sync';
import { LANG_LABELS, langFromPath, rememberPath, type Lang } from '../language';
import { registerServiceWorker } from '../pwa';
import { SettingsIcon, SyncIcon } from './icons';
import { LanguageSwitch } from './LanguageSwitch';
import { SECTIONS, type Section } from './sections';
import { TabBar } from './TabBar';
import { UpdateBanner } from './UpdateBanner';

/**
 * Deux gabarits, pas un seul redimensionné (bascule à 1024 px) :
 * - grand écran : barre latérale permanente, la bascule de langue en tête ;
 * - téléphone : une barre d'onglets sous le pouce (`TabBar`), qui porte les
 *   sections, la bascule de langue et les réglages.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const lang = langFromPath(pathname);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => registerServiceWorker(() => setUpdateReady(true)), []);

  useEffect(() => {
    rememberPath(pathname);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.lang = 'fr';
  }, []);

  return (
    <div data-lang={lang ?? undefined} className="min-h-dvh bg-page text-ink lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-6 border-r border-line bg-rail px-4 py-6 lg:flex">
        <Link to="/" className="px-2 font-display text-2xl font-semibold text-ink no-underline">
          Languages
        </Link>
        <LanguageSwitch current={lang} />
        {lang && <SectionNav lang={lang} />}
        <div className="mt-auto border-t border-line-strong pt-4">
          <SyncLink />
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(var(--tab-bar-height)+5.5rem)] lg:pb-0">
        <Outlet />
      </main>

      <TabBar lang={lang} />

      {updateReady && <UpdateBanner />}
    </div>
  );
}

function SectionNav({ lang }: { lang: Lang }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label={LANG_LABELS[lang].french} className="flex flex-col gap-1">
      <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
        {LANG_LABELS[lang].french}
      </div>
      {SECTIONS[lang].map((section) => (
        <SectionLink key={section.to} section={section} active={section.matches(pathname)} />
      ))}
    </nav>
  );
}

function SectionLink({ section, active }: { section: Section; active: boolean }) {
  const items = useCollection(REPOSITORIES[section.collection], section.collection);
  const SectionIcon = section.icon;
  return (
    <Link
      to={section.to}
      aria-current={active ? 'page' : undefined}
      className={`flex h-10 items-center justify-between rounded-lg px-2.5 text-sm no-underline ${
        active ? 'bg-accent-soft font-semibold text-accent-text' : 'text-ink-3 hover:bg-chip'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <SectionIcon />
        {section.label}
      </span>
      {items && <span className="text-xs font-medium">{items.length}</span>}
    </Link>
  );
}

/** Pied de barre latérale : l'état de la synchronisation, qui mène aux réglages. */
function SyncLink() {
  const state = useSyncState();
  const configured = readToken() !== '';
  const detail = !configured
    ? 'non configurée'
    : state.running
      ? 'en cours…'
      : state.lastError
        ? 'en échec'
        : state.lastAt
          ? `à ${new Date(state.lastAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          : 'en attente';
  return (
    <NavLink
      to="/reglages"
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm no-underline ${
          isActive ? 'bg-chip text-ink' : 'text-ink-3 hover:bg-chip'
        }`
      }
    >
      {configured ? <SyncIcon /> : <SettingsIcon />}
      <span className="flex flex-col leading-tight">
        Réglages
        <span className={`text-xs ${state.lastError ? 'text-danger' : 'text-ink-soft'}`}>Synchronisation {detail}</span>
      </span>
    </NavLink>
  );
}
