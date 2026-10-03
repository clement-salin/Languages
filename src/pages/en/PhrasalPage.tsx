import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FloatingAction } from '../../components/FloatingAction';
import { BackIcon, ChevronIcon } from '../../components/icons';
import { HeaderAction, PageHeader, SearchField } from '../../components/PageHeader';
import { enPhrasals, updatePhrasal } from '../../data/en-phrasals';
import { useCollection } from '../../data/hooks';
import { irregularForms } from '../../domain/en/irregular';
import { groupPhrasals, translatable, type GroupMode, type PhrasalGroup, type PhrasalVerb } from '../../domain/en/phrasal';
import { fold, plural } from '../../domain/text';
import { AddPhrasalForm } from './AddPhrasalForm';
import { EntryCard } from './EntryCard';
import { groupPath, modeFromSegment, rememberedMode, rememberMode } from './paths';

let rememberedQuery = '';

/**
 * Phrasal verbs, regroupés par verbe (sit → down, up, by…) ou par
 * particule (up → get up, sit up…). Sur grand écran, la liste des groupes
 * et le groupe choisi côte à côte ; sur téléphone, l'un ou l'autre.
 */
export function PhrasalPage() {
  const params = useParams();
  const navigate = useNavigate();
  const routeMode = modeFromSegment(params['mode']);
  const mode: GroupMode = routeMode ?? rememberedMode();
  const selectedKey = routeMode ? params['key'] : undefined;

  const phrasals = useCollection(enPhrasals, 'enPhrasals');
  const [query, setQueryState] = useState(rememberedQuery);
  const [adding, setAdding] = useState(false);
  const setQuery = (v: string) => setQueryState((rememberedQuery = v));

  const groups = useMemo(() => {
    if (!phrasals) return null;
    const q = fold(query.trim());
    const list = q
      ? phrasals.filter((p) => fold(`${p.base} ${p.particle} ${p.meaning} ${p.example}`).includes(q))
      : phrasals;
    return groupPhrasals(list, mode);
  }, [phrasals, query, mode]);

  // Le groupe choisi se lit sur la liste complète : une recherche ne doit pas vider la fiche ouverte.
  const selected = useMemo(
    () => (phrasals && selectedKey !== undefined
      ? groupPhrasals(phrasals, mode).find((g) => g.key === selectedKey)
      : undefined),
    [phrasals, mode, selectedKey],
  );

  const baseCount = phrasals ? new Set(phrasals.map((p) => p.base)).size : 0;

  function switchMode(next: GroupMode): void {
    rememberMode(next);
    navigate('/en');
  }

  return (
    <>
      <div className={selectedKey !== undefined ? 'hidden lg:block' : undefined}>
        <PageHeader
          title="Phrasal verbs"
          subtitle={phrasals && phrasals.length > 0
            ? `${plural(phrasals.length, 'expression')}, ${plural(baseCount, 'verbe')} de base`
            : undefined}
          actions={
            <>
              <ModeSwitch mode={mode} onChange={switchMode} />
              <SearchField value={query} onChange={setQuery} label="Rechercher" placeholder="sit, down, s’asseoir…" />
              <HeaderAction label="Ajouter" onClick={() => setAdding(true)} />
            </>
          }
        />
        {adding && (
          <AddPhrasalForm onClose={() => setAdding(false)} existing={new Set(phrasals?.map((p) => p.id))} />
        )}
      </div>

      <div className="flex items-start gap-5 px-5 pb-7 lg:px-8">
        <section aria-label="Groupes" className={`w-full lg:w-[260px] lg:shrink-0 ${selectedKey !== undefined ? 'hidden lg:block' : ''}`}>
          {groups === null ? (
            <p className="text-ink-soft">Chargement…</p>
          ) : phrasals?.length === 0 ? (
            <div className="rounded-[14px] border border-line bg-surface p-5 text-ink-3">
              <p className="m-0">Aucun phrasal verb pour l’instant.</p>
              <p className="m-0 mt-1">Ajoute le premier : « sit down », « get over »…</p>
            </div>
          ) : groups.length === 0 ? (
            <p className="text-ink-soft">Aucune expression ne correspond.</p>
          ) : (
            <>
              {/* Grand écran : la liste des groupes. */}
              <GroupIndex groups={groups} mode={mode} selectedKey={selectedKey} />
              {/* Téléphone : tous les groupes dépliés. */}
              <GroupedList groups={groups} mode={mode} />
            </>
          )}
        </section>

        <div className={`min-w-0 flex-1 ${selectedKey === undefined ? 'hidden lg:block' : 'pt-[max(1rem,var(--page-top))] lg:pt-0'}`}>
          {selectedKey === undefined ? (
            <div className="flex min-h-80 items-center justify-center rounded-[14px] border border-dashed border-line-strong p-8 text-center text-ink-soft">
              {mode === 'verb' ? 'Choisis un verbe pour voir ses phrasal verbs.' : 'Choisis une particule pour voir les verbes qui la prennent.'}
            </div>
          ) : phrasals === null ? (
            <p className="text-ink-soft">Chargement…</p>
          ) : selected ? (
            <GroupPanel group={selected} mode={mode} />
          ) : (
            <div className="rounded-[14px] border border-line bg-surface p-5">
              <Link to="/en" className="text-accent-text">← Phrasal verbs</Link>
              <p className="m-0 mt-2">Plus rien sous « {selectedKey} » dans le carnet.</p>
            </div>
          )}
        </div>
      </div>

      {selectedKey === undefined && <FloatingAction label="Ajouter un phrasal verb" onClick={() => setAdding(true)} />}
    </>
  );
}

function ModeSwitch({ mode, onChange }: { mode: GroupMode; onChange: (mode: GroupMode) => void }) {
  const choices: [GroupMode, string][] = [['verb', 'Par verbe'], ['particle', 'Par particule']];
  return (
    <div role="group" aria-label="Regrouper" className="grid w-full grid-cols-2 rounded-[10px] bg-track p-[3px] lg:flex lg:w-auto">
      {choices.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => mode !== value && onChange(value)}
          className={`h-9 cursor-pointer rounded-lg border-0 px-3 text-sm ${
            mode === value ? 'bg-surface font-medium text-ink shadow-sm' : 'bg-transparent text-ink-3'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function groupSubtitle(group: PhrasalGroup, mode: GroupMode): string {
  if (mode === 'particle') return plural(group.items.length, 'verbe');
  const forms = irregularForms(group.key);
  return forms ? `${forms.past} · ${forms.participle}` : plural(group.items.length, 'expression');
}

function GroupIndex({ groups, mode, selectedKey }: { groups: PhrasalGroup[]; mode: GroupMode; selectedKey: string | undefined }) {
  return (
    <ul className="m-0 hidden list-none overflow-hidden rounded-[14px] border border-line bg-surface p-0 lg:block">
      {groups.map((group) => (
        <li key={group.key} className="border-b border-rail last:border-b-0">
          <Link
            to={groupPath(mode, group.key)}
            aria-current={group.key === selectedKey ? 'page' : undefined}
            className={`flex items-center justify-between gap-3 px-4 py-3 text-ink no-underline ${group.key === selectedKey ? 'bg-accent-soft' : 'hover:bg-page'}`}
          >
            <span className="flex flex-col gap-0.5">
              <span lang="en" className="font-display text-lg font-semibold">{group.key}</span>
              <span className="text-[13px] text-ink-soft">{groupSubtitle(group, mode)}</span>
            </span>
            <span className="rounded-full bg-chip px-2 py-0.5 text-xs text-ink-3">{group.items.length}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GroupedList({ groups, mode }: { groups: PhrasalGroup[]; mode: GroupMode }) {
  return (
    <div className="flex flex-col gap-4 lg:hidden">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-1.5">
          <h2 className="m-0 mx-1 flex items-baseline gap-2 text-[13px] font-medium text-ink-soft">
            <Link to={groupPath(mode, group.key)} lang="en" className="font-display text-xl font-semibold text-ink no-underline">
              {group.key}
            </Link>
            {groupSubtitle(group, mode)}
          </h2>
          <ul className="m-0 list-none overflow-hidden rounded-[14px] border border-line bg-surface p-0">
            {group.items.map((p) => (
              <li key={p.id} className="border-b border-rail last:border-b-0">
                <Link to={groupPath(mode, group.key)} className="flex min-h-[52px] items-center justify-between gap-2.5 px-3.5 py-2 text-ink no-underline">
                  <span className="flex min-w-0 flex-col">
                    <PhrasalName phrasal={p} />
                    <span className="truncate text-[13px] text-ink-soft">{p.meaning}</span>
                  </span>
                  <ChevronIcon size={16} className="shrink-0 text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PhrasalName({ phrasal }: { phrasal: PhrasalVerb }) {
  return (
    <span lang="en" className="text-base font-medium">
      {phrasal.base} <span className="font-semibold text-accent-text">{phrasal.particle}</span>
    </span>
  );
}

function GroupPanel({ group, mode }: { group: PhrasalGroup; mode: GroupMode }) {
  const forms = mode === 'verb' ? irregularForms(group.key) : null;
  return (
    <article className="flex flex-col gap-5 lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:p-8">
      <Link to="/en" className="-mt-2 flex h-11 items-center gap-1 self-start font-medium text-accent-text no-underline lg:hidden">
        <BackIcon size={20} />
        Phrasal verbs
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 lang="en" className="m-0 font-display text-[40px] leading-none font-semibold">{group.key}</h2>
          <div className="text-[15px] text-ink-3">
            {mode === 'verb' ? plural(group.items.length, 'expression') : `particule · ${plural(group.items.length, 'verbe')}`}
          </div>
        </div>
        {forms && (
          <div className="flex items-center gap-2.5">
            <span lang="en" className="rounded-lg bg-page px-3 py-1.5 text-base text-ink-2">
              {group.key} – <strong className="font-semibold text-accent-text">{forms.past}</strong> –{' '}
              <strong className="font-semibold text-accent-text">{forms.participle}</strong>
            </span>
            <span className="rounded-md bg-badge px-2 py-0.5 text-xs text-badge-text">irrégulier</span>
          </div>
        )}
      </header>
      <div className="grid gap-3 xl:grid-cols-2">
        {group.items.map((p) => (
          <EntryCard
            key={p.id}
            id={p.id}
            title={<>{p.base} <span className="font-semibold text-accent-text">{p.particle}</span></>}
            translate={translatable(p)}
            fields={p}
            onUpdate={(patch) => void updatePhrasal(p.id, patch)}
            onRemove={() => {
              if (confirm(`Supprimer « ${p.id} » du carnet ?`)) void enPhrasals.remove(p.id);
            }}
          />
        ))}
      </div>
    </article>
  );
}
