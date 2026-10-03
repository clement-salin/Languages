import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon } from '../../components/icons';
import { TranslationSuggestion, type CheckedSuggestion } from '../../components/TranslationSuggestion';
import { cleanGermanSuggestion } from '../../domain/de/suggestion';
import { addVerb } from '../../data/de-verbs';
import type { Lexicon } from '../../data/lexicon';
import { verbPath } from './paths';

/**
 * Ajout d'un verbe, avec autocomplétion sur les ~8 400 infinitifs du
 * dictionnaire et propositions en cas de faute de frappe.
 */
export function AddVerbForm({ lexicon, onClose }: { lexicon: Lexicon; onClose: () => void }) {
  const navigate = useNavigate();
  const [verb, setVerb] = useState('');
  const [translation, setTranslation] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const [unknown, setUnknown] = useState<{ raw: string; word: string; close: string[] } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const verbRef = useRef<HTMLInputElement>(null);
  const translationRef = useRef<HTMLInputElement>(null);

  // Le formulaire s'ouvre en haut de page : on l'amène sous les yeux.
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'nearest' });
    verbRef.current?.focus();
  }, []);

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
    translationRef.current?.focus();
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

  /** Ne propose qu'un verbe du dictionnaire : c'est lui qui donnera la conjugaison. */
  function checkGerman(raw: string): CheckedSuggestion {
    const candidate = cleanGermanSuggestion(raw);
    const result = lexicon.lookup(candidate);
    if (!result.ok) return { value: raw, usable: false, note: 'absent du dictionnaire : pas un verbe connu' };
    return { value: result.verb.reflexive ? `sich ${result.verb.infinitive}` : result.verb.infinitive, usable: true };
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setDismissed(true);
    const raw = verb.trim();
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
    const id = result.verb.reflexive ? `sich ${result.verb.infinitive}` : result.verb.infinitive;
    await addVerb({ id, translation: translation.trim() });
    onClose();
    navigate(verbPath(id));
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
          <label htmlFor="verb-input" className="sr-only">Infinitif en allemand</label>
          <input
            ref={verbRef}
            id="verb-input"
            type="text"
            lang="de"
            value={verb}
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setDismissed(true)}
            placeholder="fahren, sich freuen, anrufen…"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
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
        <label htmlFor="translation-input" className="sr-only">Traduction en français</label>
        <input
          ref={translationRef}
          id="translation-input"
          type="text"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="Traduction (ou le verbe en français)"
          enterKeyHint="done"
          className="h-11 flex-1 rounded-[10px] border border-line-strong bg-surface px-3 text-base"
        />
        <button type="submit" className="h-11 cursor-pointer rounded-[10px] border-0 bg-accent px-5 font-semibold text-white">
          Ajouter
        </button>
      </div>
      <div className="mt-2">
        {verb.trim() !== '' || translation.trim() === '' ? (
          <TranslationSuggestion text={verb.trim()} source="DE" onUse={setTranslation} />
        ) : (
          // Seule la traduction est remplie : on cherche le verbe allemand.
          <TranslationSuggestion
            text={translation.trim()}
            source="FR"
            target="DE"
            label="Trouver le verbe allemand (DeepL)"
            check={checkGerman}
            onUse={(value) => {
              setVerb(value);
              setOptions([]);
              setUnknown(null);
            }}
          />
        )}
      </div>
      {unknown && (
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
