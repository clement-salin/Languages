import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon } from '../../components/icons';
import { TranslationSuggestion } from '../../components/TranslationSuggestion';
import { addPhrasal } from '../../data/en-phrasals';
import { irregularForms } from '../../domain/en/irregular';
import { parsePhrasal, phrasalId, translatable } from '../../domain/en/phrasal';
import { groupPath } from './paths';

/**
 * Ajout d'une expression. Le sens est saisi à la main : il n'existe pas de
 * dictionnaire libre de phrasal verbs assez fiable, et l'app ne devine pas
 * une traduction.
 */
export function AddPhrasalForm({ onClose, existing }: { onClose: () => void; existing: Set<string> }) {
  const navigate = useNavigate();
  const [expression, setExpression] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'nearest' });
    firstRef.current?.focus();
  }, []);

  const parsed = parsePhrasal(expression);
  const forms = parsed ? irregularForms(parsed.base) : null;
  const duplicate = parsed !== null && existing.has(phrasalId(parsed.base, parsed.particle));

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!parsed) {
      setError('Écris le verbe suivi de sa particule : « sit down », « get over », « sit in on ».');
      firstRef.current?.focus();
      return;
    }
    if (!duplicate) {
      await addPhrasal({ ...parsed, meaning: meaning.trim(), example: example.trim() });
    }
    onClose();
    navigate(groupPath('verb', parsed.base));
  }

  const field = 'h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-base';
  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} autoComplete="off" className="mx-5 mb-4 rounded-[14px] border border-line bg-surface p-4 lg:mx-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-base font-semibold">Ajouter un phrasal verb</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-3">
          <CloseIcon />
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-1">
          <label htmlFor="phrasal-input" className="text-sm text-ink-3">Expression</label>
          <input
            ref={firstRef}
            id="phrasal-input"
            lang="en"
            value={expression}
            onChange={(e) => {
              setExpression(e.target.value);
              setError(null);
            }}
            placeholder="sit down"
            autoCapitalize="none"
            spellCheck={false}
            className={field}
          />
          <p className="m-0 min-h-5 text-xs text-ink-soft" aria-live="polite">
            {parsed && (
              <>
                verbe <strong className="text-ink-2">{parsed.base}</strong>
                {forms && ` (${forms.past} · ${forms.participle})`} · particule{' '}
                <strong className="text-accent-text">{parsed.particle}</strong>
                {duplicate && ' · déjà dans le carnet'}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="meaning-input" className="text-sm text-ink-3">Sens en français</label>
          <input id="meaning-input" value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="s’asseoir" className={field} />
          <TranslationSuggestion text={parsed ? translatable(parsed) : ''} source="EN" onUse={setMeaning} />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="example-input" className="text-sm text-ink-3">Exemple (facultatif)</label>
          <input id="example-input" lang="en" value={example} onChange={(e) => setExample(e.target.value)} placeholder="Please sit down, the film is starting." className={field} />
        </div>
      </div>
      {error && <p role="alert" className="m-0 mt-3 text-sm text-danger">{error}</p>}
      <button type="submit" className="mt-3 h-11 cursor-pointer rounded-[10px] border-0 bg-accent px-5 font-semibold text-white">
        {duplicate ? 'Voir la fiche' : 'Ajouter'}
      </button>
    </form>
  );
}
