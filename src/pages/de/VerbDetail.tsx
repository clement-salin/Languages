import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackIcon } from '../../components/icons';
import { TranslationSuggestion } from '../../components/TranslationSuggestion';
import { deVerbs, updateVerb } from '../../data/de-verbs';
import type { Lexicon } from '../../data/lexicon';
import type { Auxiliary } from '../../domain/de/auxiliary';
import type { SavedVerb } from '../../domain/de/saved-verb';
import {
  PERSONS, VERB_CLASS_LABELS, type Conjugation, type ReflexiveCase, type Tense, type TenseId,
} from '../../domain/de/verb';
import { useDebouncedSave } from '../../use-debounced-save';

/** Temps affichés d'emblée ; les autres sont regroupés dans « Autres temps ». */
const MAIN_TENSES: TenseId[] = [
  'praesens', 'perfekt', 'praeteritum', 'futur1', 'plusquamperfekt', 'konjunktiv2Wuerde', 'konjunktiv2',
];

export function VerbDetail({ saved, lexicon }: { saved: SavedVerb; lexicon: Lexicon }) {
  const conj = lexicon.conjugateSaved(saved);
  const byId = new Map(conj?.tenses.map((t) => [t.id, t]));
  const main = MAIN_TENSES.map((id) => byId.get(id)).filter((t): t is Tense => !!t);
  const others = conj?.tenses.filter((t) => !MAIN_TENSES.includes(t.id)) ?? [];

  return (
    <article className="flex flex-col gap-5 lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:p-8">
      <Link to="/de" className="-mt-2 flex h-11 items-center gap-1 self-start font-medium text-accent-text no-underline lg:hidden">
        <BackIcon size={20} />
        Conjugaison
      </Link>

      <Header saved={saved} conj={conj} />

      {conj ? (
        <>
          <PrincipalParts conj={conj} saved={saved} />
          {conj.incomplete && (
            <p className="m-0 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              Certaines formes manquent dans le dictionnaire pour ce verbe : elles apparaissent comme « — ».
            </p>
          )}
          <TenseChips tenses={main} hasImperative={!!conj.imperative} />
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-x-8 lg:gap-y-6 2xl:grid-cols-3">
            {main.map((t) => <TenseTable key={t.id} tense={t} />)}
            {conj.imperative && <ImperativeTable conj={conj} />}
          </div>
          {others.length > 0 && (
            <details className="rounded-[14px] border border-line bg-surface p-4 lg:p-0 lg:border-0">
              <summary className="cursor-pointer text-sm font-medium text-ink-2">
                Autres temps : {others.map((t) => t.name).join(', ')}
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:gap-x-8 2xl:grid-cols-3">
                {others.map((t) => <TenseTable key={t.id} tense={t} />)}
              </div>
            </details>
          )}
          {conj.presentStemChange && (
            <p className="m-0 text-sm text-ink-soft">
              <mark>En couleur</mark> : formes dont le radical change au présent.
            </p>
          )}
        </>
      ) : (
        <p className="m-0">« {saved.id} » n’a pas été trouvé dans le dictionnaire : impossible d’afficher sa conjugaison.</p>
      )}

      <Notes saved={saved} />
      <DeleteButton saved={saved} />
    </article>
  );
}

function Header({ saved, conj }: { saved: SavedVerb; conj: Conjugation | null }) {
  const [translation, setTranslation] = useState(saved.translation);
  useDebouncedSave(translation, (value) => void updateVerb(saved.id, { translation: value.trim() }));
  return (
    <header className="flex flex-col gap-2">
      <h2 lang="de" className="m-0 font-display text-[38px] leading-none font-semibold lg:text-[40px]">
        {conj?.displayInfinitive ?? saved.id}
      </h2>
      <label className="sr-only" htmlFor="translation-edit">Traduction en français</label>
      <input
        id="translation-edit"
        type="text"
        value={translation}
        onChange={(e) => setTranslation(e.target.value)}
        placeholder="Ajouter une traduction…"
        className="-mx-2 h-10 rounded-lg border border-transparent bg-transparent px-2 text-base text-ink-3 hover:border-line focus:border-line-strong focus:bg-surface"
      />
      <TranslationSuggestion text={saved.id} source="DE" onUse={setTranslation} />
      {conj && (
        <ul aria-label="Caractéristiques" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {badges(conj).map(([label, title, accent]) => (
            <li
              key={label}
              title={title}
              className={`rounded-md px-2 py-0.5 text-xs ${accent ? 'bg-accent-soft text-accent-text' : 'bg-badge text-badge-text'}`}
            >
              {label}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

/** [libellé, explication, accentué] */
function badges(conj: Conjugation): [string, string, boolean][] {
  const titles: Record<Conjugation['verbClass'], string> = {
    weak: 'Verbe faible (régulier) : prétérit en -te, participe en -t',
    strong: 'Verbe fort : le radical change au prétérit, participe en -en',
    mixed: 'Verbe mixte : radical modifié mais terminaisons faibles (-te, -t)',
    modal: 'Verbe de modalité',
    irregular: 'Verbe irrégulier',
  };
  const out: [string, string, boolean][] = [
    [VERB_CLASS_LABELS[conj.verbClass], titles[conj.verbClass], false],
    [`auxiliaire ${conj.auxiliary}`, `Temps composés avec « ${conj.auxiliary} »`, true],
  ];
  if (conj.verb.prefix && conj.separable) {
    out.push([`particule « ${conj.verb.prefix} »`, 'Particule séparable : elle se place en fin de proposition', false]);
  } else if (conj.verb.prefix && conj.verb.separability !== 'separable') {
    out.push(['inséparable', `« ${conj.verb.prefix} » reste attaché au verbe`, false]);
  }
  if (conj.presentStemChange) out.push(['radical modifié au présent', 'Voir les formes en couleur au Präsens', false]);
  if (conj.verb.reflexive) out.push(['pronominal', 'Verbe réfléchi (sich …)', false]);
  return out;
}

function PrincipalParts({ conj, saved }: { conj: Conjugation; saved: SavedVerb }) {
  const pp = conj.principalParts;
  const parts = [pp.infinitive, pp.present3, pp.preterite3, pp.perfect3];
  return (
    <section aria-label="Formes principales" className="flex flex-col gap-3">
      <p lang="de" className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-[10px] border border-line bg-surface px-4 py-3 text-[17px] text-ink-2 lg:border-0 lg:bg-page">
        {parts.map((part, i) => (
          <span key={i} className="contents">
            {i > 0 && <span className="text-ink-faint">–</span>}
            {i === 1 && conj.presentStemChange ? <mark>{part}</mark> : <span>{part}</span>}
          </span>
        ))}
      </p>
      <p className="m-0 text-xs text-ink-soft">
        infinitif – présent (er) – prétérit (er) – parfait (er)
        {conj.participles.length > 1 && ` · participes possibles : ${conj.participles.join(', ')}`}
      </p>
      <Options conj={conj} saved={saved} />
    </section>
  );
}

/** Réglages quand le verbe admet plusieurs conjugaisons. */
function Options({ conj, saved }: { conj: Conjugation; saved: SavedVerb }) {
  const controls = [];
  if (!conj.verb.reflexive) {
    controls.push(
      <Segmented<Auxiliary>
        key="aux"
        label="Auxiliaire"
        current={conj.auxiliary}
        choices={[['haben', 'haben'], ['sein', 'sein']]}
        onChange={(value) => void updateVerb(saved.id, {
          auxiliary: value === conj.auxiliaryInfo.default ? undefined : value,
        })}
        help={conj.auxiliaryInfo.both
          ? 'Ce verbe prend « sein » pour un déplacement et « haben » avec un complément d’objet.'
          : undefined}
      />,
    );
  } else {
    controls.push(
      <Segmented<ReflexiveCase>
        key="refl"
        label="Pronom réfléchi"
        current={conj.reflexiveCase}
        choices={[['acc', 'accusatif (mich)'], ['dat', 'datif (mir)']]}
        onChange={(value) => void updateVerb(saved.id, { reflexiveCase: value })}
      />,
    );
  }
  if (conj.verb.separability === 'both' && conj.verb.prefix) {
    const prefix = conj.verb.prefix;
    controls.push(
      <Segmented<'sep' | 'insep'>
        key="sep"
        label="Particule"
        current={conj.separable ? 'sep' : 'insep'}
        choices={[['insep', `inséparable (${prefix}…t)`], ['sep', `séparable (… ${prefix})`]]}
        onChange={(value) => void updateVerb(saved.id, { separable: value === 'sep' })}
        help="Le sens change : « er übersetzt » (il traduit) / « er setzt über » (il traverse)."
      />,
    );
  }
  return <div className="flex flex-col gap-3">{controls}</div>;
}

function Segmented<T extends string>({ label, current, choices, onChange, help }: {
  label: string;
  current: T;
  choices: [T, string][];
  onChange: (value: T) => void;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-soft">{label}</span>
        <div role="group" aria-label={label} className="flex rounded-[10px] bg-track p-[3px]">
          {choices.map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === current}
              onClick={() => value !== current && onChange(value)}
              className={`min-h-9 cursor-pointer rounded-lg border-0 px-3 text-sm ${
                value === current ? 'bg-surface font-medium text-ink shadow-sm' : 'bg-transparent text-ink-3'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      {help && <p className="m-0 text-xs text-ink-soft">{help}</p>}
    </div>
  );
}

/** Raccourcis vers chaque temps, sur téléphone où la fiche est longue. */
function TenseChips({ tenses, hasImperative }: { tenses: Tense[]; hasImperative: boolean }) {
  const items = [...tenses.map((t) => [t.id, t.name] as const), ...(hasImperative ? [['imperativ', 'Imperativ'] as const] : [])];
  return (
    <nav aria-label="Temps" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 lg:hidden">
      {items.map(([id, name]) => (
        <button
          key={id}
          type="button"
          onClick={() => document.getElementById(`tense-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="h-9 shrink-0 cursor-pointer rounded-full border border-line-strong bg-surface px-3.5 text-sm whitespace-nowrap text-ink-2"
        >
          {name}
        </button>
      ))}
    </nav>
  );
}

function TenseCard({ id, name, french, children }: { id: string; name: string; french: string; children: ReactNode }) {
  return (
    <section id={`tense-${id}`} className="scroll-mt-4 rounded-[14px] border border-line bg-surface px-4 py-3.5 lg:rounded-none lg:border-0 lg:p-0">
      <h3 className="m-0 mb-2 flex flex-col">
        <span lang="de" className="text-xs font-semibold tracking-[0.06em] text-accent-text uppercase">{name}</span>
        <small className="text-xs font-normal text-ink-soft">{french}</small>
      </h3>
      {children}
    </section>
  );
}

function TenseTable({ tense }: { tense: Tense }) {
  return (
    <TenseCard id={tense.id} name={tense.name} french={tense.french}>
      <table lang="de" className="w-full border-collapse text-[15px] leading-[1.7] lg:text-sm">
        <tbody>
          {tense.forms.map((form, i) => (
            <tr key={i}>
              <th scope="row" className="w-24 p-0 text-left font-normal whitespace-nowrap text-ink-soft lg:w-[5.5rem]">{PERSONS[i]}</th>
              <td className="p-0 whitespace-nowrap">{form ? (form.irregular ? <mark>{form.text}</mark> : form.text) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TenseCard>
  );
}

function ImperativeTable({ conj }: { conj: Conjugation }) {
  const imp = conj.imperative!;
  const rows: [string, string][] = [['(du)', `${imp.du} !`], ['(ihr)', `${imp.ihr} !`], ['(Sie)', `${imp.Sie} !`]];
  return (
    <TenseCard id="imperativ" name="Imperativ" french="impératif">
      <table lang="de" className="w-full border-collapse text-[15px] leading-[1.7] lg:text-sm">
        <tbody>
          {rows.map(([p, f]) => (
            <tr key={p}>
              <th scope="row" className="w-24 p-0 text-left font-normal whitespace-nowrap text-ink-soft lg:w-[5.5rem]">{p}</th>
              <td className="p-0 whitespace-nowrap">{f}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {imp.du.includes('(e)') && <p className="m-0 mt-1 text-xs text-ink-soft">Le « e » final est facultatif (surtout à l’oral).</p>}
    </TenseCard>
  );
}

function Notes({ saved }: { saved: SavedVerb }) {
  const [notes, setNotes] = useState(saved.notes);
  useDebouncedSave(notes, (value) => void updateVerb(saved.id, { notes: value }));
  const word = saved.id.replace(/^sich /, '').split(' ').pop() ?? saved.id;
  const added = new Date(saved.addedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section aria-labelledby="notes-title" className="flex flex-col gap-2 border-t border-line pt-5">
      <h3 id="notes-title" className="m-0 text-sm font-semibold">Notes</h3>
      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Une phrase d’exemple de ta leçon, une astuce…"
        aria-labelledby="notes-title"
        className="w-full resize-y rounded-[10px] border border-line-strong bg-surface p-3 text-base lg:text-sm"
      />
      <p className="m-0 text-xs text-ink-soft">
        Ajouté le {added} ·{' '}
        <a href={`https://fr.wiktionary.org/wiki/${encodeURIComponent(word)}`} target="_blank" rel="noopener" className="text-accent-text">Wiktionnaire</a>
        {' · '}
        <a href={`https://www.dwds.de/wb/${encodeURIComponent(word)}`} target="_blank" rel="noopener" className="text-accent-text">DWDS</a>
      </p>
    </section>
  );
}

function DeleteButton({ saved }: { saved: SavedVerb }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm(`Supprimer « ${saved.id} » du carnet ?`)) return;
        void deVerbs.remove(saved.id).then(() => navigate('/de'));
      }}
      className="min-h-10 cursor-pointer self-start rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-danger"
    >
      Supprimer ce verbe
    </button>
  );
}
