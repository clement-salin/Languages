import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FloatingAction } from '../../components/FloatingAction';
import { CloseIcon } from '../../components/icons';
import { TranslationSuggestion } from '../../components/TranslationSuggestion';
import { HeaderAction, PageHeader, SearchField } from '../../components/PageHeader';
import { addExpression, enExpressions, updateExpression } from '../../data/en-expressions';
import { useCollection } from '../../data/hooks';
import { cleanExpression, expressionId, type Expression } from '../../domain/en/expression';
import { fold, plural } from '../../domain/text';
import { EntryCard } from './EntryCard';

type SortOrder = 'recent' | 'alpha';
const remembered = { query: '', sort: 'recent' as SortOrder };

/** Expressions anglaises : idiomes et tournures figées, avec leur sens. */
export function ExpressionsPage() {
  const expressions = useCollection(enExpressions, 'enExpressions');
  const [query, setQueryState] = useState(remembered.query);
  const [sort, setSortState] = useState(remembered.sort);
  const [adding, setAdding] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const setQuery = (v: string) => setQueryState((remembered.query = v));
  const setSort = (v: SortOrder) => setSortState((remembered.sort = v));

  const list = useMemo(() => {
    if (!expressions) return null;
    const q = fold(query.trim());
    const filtered = q
      ? expressions.filter((e) => fold(`${e.text} ${e.meaning} ${e.example}`).includes(q))
      : [...expressions];
    filtered.sort(sort === 'alpha'
      ? (a, b) => a.id.localeCompare(b.id, 'en')
      : (a, b) => b.addedAt.localeCompare(a.addedAt));
    return filtered;
  }, [expressions, query, sort]);

  // Une expression ajoutée (ou déjà présente) est amenée sous les yeux.
  useEffect(() => {
    if (highlight) document.getElementById(`expression-${highlight}`)?.scrollIntoView({ block: 'center' });
  }, [highlight, list]);

  return (
    <>
      <PageHeader
        title="Expressions"
        subtitle={expressions && expressions.length > 0 ? plural(expressions.length, 'expression') : undefined}
        actions={
          <>
            <SearchField value={query} onChange={setQuery} label="Rechercher" placeholder="ice, glace…" />
            <HeaderAction label="Ajouter" onClick={() => setAdding(true)} />
          </>
        }
      />
      {adding && (
        <AddExpressionForm
          existing={new Set(expressions?.map((e) => e.id))}
          onClose={() => setAdding(false)}
          onDone={(id) => {
            setAdding(false);
            setQuery('');
            setHighlight(id);
          }}
        />
      )}

      <div className="flex flex-col gap-3 px-5 pb-7 lg:px-8">
        {list === null ? (
          <p className="text-ink-soft">Chargement…</p>
        ) : expressions?.length === 0 ? (
          <div className="max-w-xl rounded-[14px] border border-line bg-surface p-5 text-ink-3">
            <p className="m-0">Aucune expression pour l’instant.</p>
            <p className="m-0 mt-1">Ajoute la première : « break the ice », « it’s not my cup of tea »…</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label htmlFor="expression-sort" className="sr-only">Trier</label>
              <select
                id="expression-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                className="h-8 rounded-full border border-line-strong bg-surface px-2 text-[13px] text-ink-2"
              >
                <option value="recent">Plus récentes</option>
                <option value="alpha">A → Z</option>
              </select>
            </div>
            {list.length === 0 ? (
              <p className="text-ink-soft">Aucune expression ne correspond.</p>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {list.map((e) => <ExpressionCard key={e.id} expression={e} highlighted={e.id === highlight} />)}
              </div>
            )}
          </>
        )}
      </div>

      <FloatingAction label="Ajouter une expression" onClick={() => setAdding(true)} />
    </>
  );
}

function ExpressionCard({ expression, highlighted }: { expression: Expression; highlighted: boolean }) {
  return (
    <div id={`expression-${expression.id}`} className={highlighted ? 'rounded-xl ring-2 ring-accent' : undefined}>
      <EntryCard
        id={expression.id}
        title={expression.text}
        translate={expression.text}
        fields={expression}
        onUpdate={(patch) => void updateExpression(expression.id, patch)}
        onRemove={() => {
          if (confirm(`Supprimer « ${expression.text} » du carnet ?`)) void enExpressions.remove(expression.id);
        }}
      />
    </div>
  );
}

/** Ajout d'une expression. Le sens est saisi à la main : l'app ne devine pas une traduction. */
function AddExpressionForm({ existing, onClose, onDone }: {
  existing: Set<string>;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'nearest' });
    firstRef.current?.focus();
  }, []);

  const id = expressionId(text);
  const duplicate = id !== '' && existing.has(id);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!id) {
      setError('Écris l’expression en anglais : « break the ice ».');
      firstRef.current?.focus();
      return;
    }
    if (!duplicate) await addExpression({ text, meaning: meaning.trim(), example: example.trim() });
    onDone(id);
  }

  const field = 'h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-base';
  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} autoComplete="off" className="mx-5 mb-4 rounded-[14px] border border-line bg-surface p-4 lg:mx-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-base font-semibold">Ajouter une expression</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-3">
          <CloseIcon />
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="expression-input" className="text-sm text-ink-3">Expression</label>
          <input
            ref={firstRef}
            id="expression-input"
            lang="en"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder="break the ice"
            spellCheck={false}
            className={field}
          />
          {duplicate && <p className="m-0 text-xs text-ink-soft">Déjà dans le carnet.</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="expression-meaning" className="text-sm text-ink-3">Sens en français</label>
          <input id="expression-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="briser la glace" className={field} />
          <TranslationSuggestion text={cleanExpression(text)} source="EN" onUse={setMeaning} />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="expression-example" className="text-sm text-ink-3">Exemple (facultatif)</label>
          <input id="expression-example" lang="en" value={example} onChange={(e) => setExample(e.target.value)} placeholder="A quick game helped break the ice." className={field} />
        </div>
      </div>
      {error && <p role="alert" className="m-0 mt-3 text-sm text-danger">{error}</p>}
      <button type="submit" className="mt-3 h-11 cursor-pointer rounded-[10px] border-0 bg-accent px-5 font-semibold text-white">
        {duplicate ? 'Voir la fiche' : 'Ajouter'}
      </button>
    </form>
  );
}
