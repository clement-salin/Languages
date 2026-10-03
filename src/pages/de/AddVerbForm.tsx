import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon } from '../../components/icons';
import { addVerb } from '../../data/de-verbs';
import type { Lexicon } from '../../data/lexicon';
import { canTranslate, suggestTranslation, TranslateError } from '../../data/translate';
import { levenshtein } from '../../domain/de/search';
import { cleanGermanSuggestion } from '../../domain/de/suggestion';
import { verbPath } from './paths';

/** Pause de frappe avant de chercher en français : une demande par mot, pas par lettre. */
const FRENCH_DELAY_MS = 700;

/**
 * Ajout d'un verbe, en un seul champ.
 *
 * - Un verbe allemand : autocomplétion sur les ~8 400 infinitifs du
 *   dictionnaire, propositions en cas de faute de frappe.
 * - Un mot que le dictionnaire allemand ne connaît pas (« manger ») : l'app
 *   le traduit d'elle-même depuis le français (DeepL) et propose le verbe
 *   allemand (« essen »), avec le mot français pour traduction. Rien n'est
 *   ajouté sans un clic.
 */
export function AddVerbForm({ lexicon, onClose }: { lexicon: Lexicon; onClose: () => void }) {
  const navigate = useNavigate();
  const [verb, setVerb] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const [unknown, setUnknown] = useState<{ raw: string; word: string; close: string[] } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const verbRef = useRef<HTMLInputElement>(null);

  // Le formulaire s'ouvre en haut de page : on l'amène sous les yeux.
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'nearest' });
    verbRef.current?.focus();
  }, []);

  const raw = verb.trim();
  const known = raw !== '' && lexicon.lookup(raw).ok;
  // Ni verbe connu, ni début d'un verbe connu : sans doute du français.
  const french = useFrenchToGerman(raw.length >= 3 && !known && options.length === 0 ? raw : '', lexicon);

  const open = options.length > 0 && !dismissed;

  function change(value: string): void {
    setVerb(value);
    setUnknown(null);
    setDismissed(false);
    setActive(-1);
    setOptions(value.trim() ? lexicon.index.complete(value) : []);
  }

  function choose(option: string): void {
    setVerb(option);
    setOptions([]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(options[active]!);
    } else if (e.key === 'Escape') {
      setDismissed(true);
    }
  }

  async function add(id: string, translation: string): Promise<void> {
    await addVerb({ id, translation });
    onClose();
    navigate(verbPath(id));
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setDismissed(true);
    if (!raw) {
      verbRef.current?.focus();
      return;
    }
    const result = lexicon.lookup(raw);
    if (!result.ok) {
      const word = raw.split(/\s+/).pop() ?? raw;
      setUnknown({ raw, word, close: lexicon.index.closest(word) });
      return;
    }
    await add(result.verb.reflexive ? `sich ${result.verb.infinitive}` : result.verb.infinitive, '');
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => void submit(e)}
      autoComplete="off"
      className="mx-5 mb-4 rounded-[14px] border border-line bg-surface p-4 lg:mx-8"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-base font-semibold">Ajouter un verbe</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-3">
          <CloseIcon />
        </button>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <label htmlFor="verb-input" className="sr-only">
            Verbe en allemand{canTranslate() ? ', ou en français' : ''}
          </label>
          <input
            ref={verbRef}
            id="verb-input"
            type="text"
            value={verb}
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setDismissed(true)}
            placeholder={canTranslate() ? 'fahren, sich freuen… ou manger' : 'fahren, sich freuen, anrufen…'}
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="verb-suggestions"
            aria-activedescendant={open && active >= 0 ? `suggestion-${active}` : undefined}
            className="h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-base"
          />
          {open && (
            <ul id="verb-suggestions" role="listbox" className="absolute inset-x-0 top-12 z-20 m-0 list-none overflow-hidden rounded-[10px] border border-line bg-surface p-1 shadow-lg">
              {options.map((option, i) => (
                <li
                  key={option}
                  id={`suggestion-${i}`}
                  role="option"
                  lang="de"
                  aria-selected={i === active}
                  // onPointerDown plutôt que onClick : le clic ferme d'abord le
                  // clavier sur iOS, ce qui déplace la liste sous le doigt.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    choose(option);
                  }}
                  className={`cursor-pointer rounded-md px-3 py-2.5 ${i === active ? 'bg-accent-soft text-accent-text' : ''}`}
                >
                  {option}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="h-11 cursor-pointer rounded-[10px] border-0 bg-accent px-5 font-semibold text-white">
          Ajouter
        </button>
      </div>

      {french.state !== 'idle' && (
        <div aria-live="polite" className="mt-3 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {french.state === 'loading' && <span className="text-ink-soft">Recherche en allemand…</span>}
          {french.state === 'found' && (
            <>
              {french.typo ? (
                <span className="text-ink-soft">Vouliez-vous dire</span>
              ) : (
                <>
                  <span className="text-ink-soft">En français ?</span>
                  <span className="text-ink-2">{french.from}</span>
                  <span aria-hidden="true" className="text-ink-faint">→</span>
                </>
              )}
              <span lang="de" className="font-semibold text-ink">{french.verb}</span>
              <button
                type="button"
                // Une faute de frappe corrigée n'est pas une traduction.
                onClick={() => void add(french.verb, french.typo ? '' : french.from)}
                className="min-h-9 cursor-pointer rounded-lg border border-line-strong bg-surface px-3 text-accent-text"
              >
                Ajouter « {french.verb} »
              </button>
            </>
          )}
          {french.state === 'not-a-verb' && (
            <span className="text-ink-soft">
              En français, DeepL propose « <span lang="de">{french.proposal}</span> », qui n’est pas un verbe du dictionnaire.
            </span>
          )}
          {french.state === 'error' && <span className="text-warn">{french.message}</span>}
        </div>
      )}

      {unknown && french.state !== 'found' && (
        <div role="alert" className="mt-3 text-sm">
          <p className="m-0 text-danger">« {unknown.raw} » n’est pas dans le dictionnaire.</p>
          {unknown.close.length > 0 && (
            <p className="m-0 mt-1">
              Vouliez-vous dire :{' '}
              {unknown.close.map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    lang="de"
                    onClick={() => change(unknown.raw.slice(0, unknown.raw.length - unknown.word.length) + c)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-accent-text underline"
                  >
                    {c}
                  </button>
                </span>
              ))}{' '}
              ?
            </p>
          )}
        </div>
      )}
    </form>
  );
}

type FrenchLookup =
  | { state: 'idle' }
  | { state: 'loading' }
  /** `typo` : DeepL a corrigé une faute de frappe allemande, ce n'était pas du français. */
  | { state: 'found'; from: string; verb: string; typo: boolean }
  | { state: 'not-a-verb'; proposal: string }
  | { state: 'error'; message: string };

/**
 * Traduit d'elle-même une saisie française en verbe allemand, après une
 * pause de frappe. Le verbe proposé n'est retenu que si le dictionnaire le
 * connaît : c'est lui qui donne la conjugaison.
 *
 * Éteint sans jeton de synchronisation (la traduction passe par le serveur).
 */
function useFrenchToGerman(text: string, lexicon: Lexicon): FrenchLookup {
  const [result, setResult] = useState<FrenchLookup & { for?: string }>({ state: 'idle' });

  useEffect(() => {
    if (text === '' || !canTranslate()) {
      setResult({ state: 'idle' });
      return;
    }
    let alive = true;
    setResult({ state: 'loading', for: text });
    const timer = setTimeout(() => {
      suggestTranslation(text, 'FR', 'DE').then(
        (raw) => {
          if (!alive) return;
          const cleaned = cleanGermanSuggestion(raw);
          // Rendu tel quel : DeepL n'y a rien reconnu de français.
          if (cleaned.toLowerCase() === text.toLowerCase()) {
            setResult({ state: 'idle' });
            return;
          }
          const lookup = lexicon.lookup(cleaned);
          if (!lookup.ok) {
            setResult({ state: 'not-a-verb', proposal: raw, for: text });
            return;
          }
          const verb = lookup.verb.reflexive ? `sich ${lookup.verb.infinitive}` : lookup.verb.infinitive;
          const typo = levenshtein(text.toLowerCase(), verb.toLowerCase(), 3) <= 2;
          setResult({ state: 'found', from: text, verb, typo, for: text });
        },
        (error: unknown) => {
          if (alive) {
            setResult({
              state: 'error',
              message: error instanceof TranslateError ? error.message : 'Recherche en allemand impossible.',
              for: text,
            });
          }
        },
      );
    }, FRENCH_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [text, lexicon]);

  return result.state !== 'idle' && result.for !== text ? { state: 'idle' } : result;
}
