import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { deVerbs } from '../data/de-verbs';
import { enPhrasals } from '../data/en-phrasals';
import { useCollection, useSyncState } from '../data/hooks';
import { readToken } from '../data/sync';
import { LANG_LABELS, langFromPath, rememberPath, type Lang } from '../language';
import { registerServiceWorker } from '../pwa';
import { BranchIcon, SettingsIcon, SyncIcon, TableIcon } from './icons';
import { LanguageSwitch } from './LanguageSwitch';
import { UpdateBanner } from './UpdateBanner';

/**
 * Deux gabarits, pas un seul redimensionné (bascule à 1024 px) :
 * - grand écran : barre latérale permanente, la bascule de langue en tête ;
 * - téléphone : la bascule de langue en barre fixe sous le pouce.
 *
 * Les sections d'une langue n'apparaissent en onglets sur téléphone qu'à
 * partir de deux : un onglet unique serait un contrôle qui ne mène nulle
 * part ailleurs.
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
        <LanguageSwitch current={lang} variant="rail" />
        {lang && <SectionNav lang={lang} />}
        <div className="mt-auto border-t border-line-strong pt-4">
          <SyncLink />
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(var(--lang-bar-height)+5.5rem)] lg:pb-0">
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-page/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <LanguageSwitch current={lang} variant="bar" />
      </div>

      {updateReady && <UpdateBanner />}
    </div>
  );
}

const SECTIONS: Record<Lang, { to: string; label: string; icon: typeof TableIcon; count: 'de' | 'en' }[]> = {
  de: [{ to: '/de', label: 'Conjugaison', icon: TableIcon, count: 'de' }],
  en: [{ to: '/en', label: 'Phrasal verbs', icon: BranchIcon, count: 'en' }],
};

function SectionNav({ lang }: { lang: Lang }) {
  const verbs = useCollection(deVerbs, 'deVerbs');
  const phrasals = useCollection(enPhrasals, 'enPhrasals');
  const counts = { de: verbs?.length, en: phrasals?.length };
  return (
    <nav aria-label={LANG_LABELS[lang].french} className="flex flex-col gap-1">
      <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
        {LANG_LABELS[lang].french}
      </div>
      {SECTIONS[lang].map(({ to, label, icon: SectionIcon, count }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex h-10 items-center justify-between rounded-lg px-2.5 text-sm no-underline ${
              isActive ? 'bg-accent-soft font-semibold text-accent-text' : 'text-ink-3 hover:bg-chip'
            }`
          }
        >
          <span className="flex items-center gap-2.5">
            <SectionIcon />
            {label}
          </span>
          {counts[count] !== undefined && <span className="text-xs font-medium">{counts[count]}</span>}
        </NavLink>
      ))}
    </nav>
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
