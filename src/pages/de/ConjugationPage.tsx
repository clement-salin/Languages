import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FloatingAction } from '../../components/FloatingAction';
import { HeaderAction, PageHeader, SearchField } from '../../components/PageHeader';
import { deVerbs } from '../../data/de-verbs';
import { useCollection, useLexicon } from '../../data/hooks';
import type { SavedVerb } from '../../domain/de/saved-verb';
import { VERB_CLASS_LABELS, type Conjugation } from '../../domain/de/verb';
import { fold, plural } from '../../domain/text';
import { AddVerbForm } from './AddVerbForm';
import { verbPath } from './paths';
import { VerbDetail } from './VerbDetail';

type SortOrder = 'recent' | 'oldest' | 'alpha';
type Filter = 'all' | 'strong' | 'weak' | 'irregular' | 'sein' | 'prefix';

const FILTERS: [Filter, string][] = [
  ['all', 'Tous'],
  ['strong', 'Forts'],
  ['weak', 'Faibles'],
  ['irregular', 'Irréguliers'],
  ['sein', 'Avec sein'],
  ['prefix', 'À particule'],
];

// Recherche, tri et filtre survivent à l'ouverture d'une fiche.
const remembered = { query: '', sort: 'recent' as SortOrder, filter: 'all' as Filter };

/**
 * Conjugaison allemande : la liste du carnet et la fiche du verbe choisi.
 * Côte à côte sur grand écran ; l'une ou l'autre sur téléphone.
 */
export function ConjugationPage() {
  const { verbId } = useParams();
  const verbs = useCollection(deVerbs, 'deVerbs');
  const { lexicon, error, retry } = useLexicon();
  const [query, setQueryState] = useState(remembered.query);
  const [sort, setSortState] = useState(remembered.sort);
  const [filter, setFilterState] = useState(remembered.filter);
  const [adding, setAdding] = useState(false);

  const setQuery = (v: string) => setQueryState((remembered.query = v));
  const setSort = (v: SortOrder) => setSortState((remembered.sort = v));
  const setFilter = (v: Filter) => setFilterState((remembered.filter = v));

  const rows = useMemo(() => {
    if (!verbs) return null;
    const q = fold(query.trim());
    const list = verbs
      .map((verb) => ({ verb, conj: lexicon ? lexicon.conjugateSaved(verb) : undefined }))
      .filter(({ verb, conj }) => {
        if (q && !fold(verb.id).includes(q) && !fold(verb.translation).includes(q)) return false;
        return matchesFilter(filter, conj);
      });
    const byDate = (a: { verb: SavedVerb }, b: { verb: SavedVerb }) => b.verb.addedAt.localeCompare(a.verb.addedAt);
    if (sort === 'recent') list.sort(byDate);
    if (sort === 'oldest') list.sort((a, b) => byDate(b, a));
    if (sort === 'alpha') {
      const key = (v: SavedVerb) => v.id.replace(/^sich /, '');
      list.sort((a, b) => key(a.verb).localeCompare(key(b.verb), 'de'));
    }
    return list;
  }, [verbs, lexicon, query, sort, filter]);

  const selected = verbId !== undefined ? verbs?.find((v) => v.id === verbId) : undefined;
  const today = new Date().toDateString();
  const addedToday = verbs?.filter((v) => new Date(v.addedAt).toDateString() === today).length ?? 0;

  if (error) {
    return (
      <section className="m-5 rounded-[14px] border border-line bg-surface p-5 lg:m-8">
        <h1 className="m-0 font-display text-2xl">Dictionnaire indisponible</h1>
        <p>Le dictionnaire allemand n’a pas pu être chargé. Vérifie ta connexion puis réessaie.</p>
        <p className="text-sm text-ink-soft">{error}</p>
        <button type="button" onClick={retry} className="h-10 cursor-pointer rounded-[10px] border-0 bg-accent px-4 font-semibold text-white">
          Réessayer
        </button>
      </section>
    );
  }

  return (
    <>
      <div className={verbId !== undefined ? 'hidden lg:block' : undefined}>
        <PageHeader
          title="Conjugaison"
          subtitle={verbs && verbs.length > 0
            ? `${plural(verbs.length, 'verbe')} dans le carnet${addedToday ? ` · ${addedToday} aujourd’hui` : ''}`
            : undefined}
          actions={
            <>
              <SearchField value={query} onChange={setQuery} label="Rechercher dans le carnet" placeholder="Rechercher un verbe ou une traduction" />
              <HeaderAction label="Ajouter un verbe" onClick={() => setAdding(true)} />
            </>
          }
        />
        {adding && lexicon && <AddVerbForm lexicon={lexicon} onClose={() => setAdding(false)} />}
      </div>

      <div className="flex gap-5 px-5 pb-7 lg:px-8">
        <section
          aria-label="Verbes du carnet"
          className={`flex w-full flex-col gap-3 lg:w-[340px] lg:shrink-0 ${verbId !== undefined ? 'hidden lg:flex' : ''}`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <div role="group" aria-label="Filtrer" className="flex flex-wrap gap-1.5">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`h-8 cursor-pointer rounded-full border px-3 text-[13px] ${
                    filter === value ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="verb-sort">Trier</label>
            <select
              id="verb-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              className="h-8 rounded-full border border-line-strong bg-surface px-2 text-[13px] text-ink-2"
            >
              <option value="recent">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="alpha">A → Z</option>
            </select>
          </div>
          <VerbList rows={rows} empty={verbs?.length === 0} selectedId={verbId} />
        </section>

        <div className={`min-w-0 flex-1 ${verbId === undefined ? 'hidden lg:block' : 'pt-[max(1rem,env(safe-area-inset-top))] lg:pt-0'}`}>
          {verbId === undefined ? (
            <Placeholder count={verbs?.length ?? 0} />
          ) : !verbs || !lexicon ? (
            <p className="text-ink-soft">Chargement du dictionnaire…</p>
          ) : selected ? (
            <VerbDetail key={selected.id} saved={selected} lexicon={lexicon} />
          ) : (
            <NotFound id={verbId} />
          )}
        </div>
      </div>

      {verbId === undefined && <FloatingAction label="Ajouter un verbe" onClick={() => setAdding(true)} />}
    </>
  );
}

function matchesFilter(filter: Filter, conj: Conjugation | null | undefined): boolean {
  switch (filter) {
    case 'all': return true;
    case 'strong': return conj?.verbClass === 'strong';
    case 'weak': return conj?.verbClass === 'weak';
    case 'irregular': return !!conj && ['mixed', 'modal', 'irregular'].includes(conj.verbClass);
    case 'sein': return conj?.auxiliary === 'sein';
    case 'prefix': return !!conj?.verb.prefix && conj.separable;
  }
}

function VerbList({ rows, empty, selectedId }: {
  rows: { verb: SavedVerb; conj: Conjugation | null | undefined }[] | null;
  empty: boolean;
  selectedId: string | undefined;
}) {
  if (rows === null) return <p className="text-ink-soft">Chargement…</p>;
  if (empty) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-5 text-ink-3">
        <p className="m-0">Le carnet est vide.</p>
        <p className="m-0 mt-1">Ajoute le premier verbe de ta leçon du jour.</p>
      </div>
    );
  }
  if (rows.length === 0) return <p className="text-ink-soft">Aucun verbe ne correspond.</p>;
  return (
    <ul className="m-0 list-none overflow-hidden rounded-[14px] border border-line bg-surface p-0">
      {rows.map(({ verb, conj }) => (
        <li key={verb.id} className="border-b border-rail last:border-b-0">
          <VerbRow verb={verb} conj={conj} selected={verb.id === selectedId} />
        </li>
      ))}
    </ul>
  );
}

function VerbRow({ verb, conj, selected }: {
  verb: SavedVerb;
  /** `undefined` tant que le dictionnaire charge, `null` pour un verbe non reconnu. */
  conj: Conjugation | null | undefined;
  selected: boolean;
}) {
  const p = conj?.principalParts;
  return (
    <Link
      to={verbPath(verb.id)}
      aria-current={selected ? 'page' : undefined}
      className={`flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-ink no-underline ${selected ? 'bg-accent-soft' : 'hover:bg-page'}`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span lang="de" className="font-display text-[17px] font-semibold">{verb.id}</span>
          {verb.translation && <span className="truncate text-sm text-ink-3">{verb.translation}</span>}
        </span>
        <span lang="de" className="truncate text-[13px] text-ink-soft">
          {p ? `${p.present3} · ${p.preterite3} · ${p.perfect3}` : conj === undefined ? '…' : 'verbe non reconnu'}
        </span>
      </span>
      {conj && (
        <span className="shrink-0 rounded-md bg-badge px-2 py-0.5 text-xs text-badge-text">{VERB_CLASS_LABELS[conj.verbClass]}</span>
      )}
    </Link>
  );
}

function Placeholder({ count }: { count: number }) {
  return (
    <div className="flex h-full min-h-80 items-center justify-center rounded-[14px] border border-dashed border-line-strong p-8 text-center text-ink-soft">
      {count > 0 ? 'Choisis un verbe dans la liste pour voir sa conjugaison.' : 'Les conjugaisons s’afficheront ici.'}
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <Link to="/de" className="text-accent-text">← Conjugaison</Link>
      <h2 className="font-display">Verbe introuvable</h2>
      <p className="m-0">« {id} » n’est pas (ou plus) dans le carnet.</p>
    </div>
  );
}

