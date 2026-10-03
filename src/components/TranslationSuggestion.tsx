import { useEffect, useState } from 'react';
import { canTranslate, suggestTranslation, TranslateError, type SourceLang } from '../data/translate';

/**
 * Propose une traduction DeepL sous un champ « sens » ou « traduction ».
 *
 * **Une proposition, jamais un remplissage** : la traduction s'affiche avec
 * un bouton « Utiliser » ; rien n'entre dans le champ sans ce geste. Une
 * traduction automatique d'un mot isolé se trompe souvent de sens.
 *
 * Absent sur un appareil sans jeton de synchronisation : le bouton ne
 * pourrait qu'échouer.
 */
export function TranslationSuggestion({ text, source, onUse }: {
  /** Ce qu'il faut traduire ; vide tant que la saisie ne permet rien. */
  text: string;
  source: SourceLang;
  onUse: (translation: string) => void;
}) {
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; for: string; translation: string } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // Une suggestion faite pour un autre texte n'a plus cours.
  useEffect(() => {
    setState((s) => (s.kind === 'done' && s.for !== text ? { kind: 'idle' } : s.kind === 'error' ? { kind: 'idle' } : s));
  }, [text]);

  if (!canTranslate()) return null;

  async function ask(): Promise<void> {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'done', for: text, translation: await suggestTranslation(text, source) });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof TranslateError ? error.message : 'Suggestion impossible.' });
    }
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {state.kind === 'done' ? (
        <>
          <span className="text-ink-soft">DeepL propose :</span>
          <span className="font-medium text-ink-2">« {state.translation} »</span>
          <button
            type="button"
            onClick={() => {
              onUse(state.translation);
              setState({ kind: 'idle' });
            }}
            className="min-h-9 cursor-pointer rounded-lg border border-line-strong bg-surface px-3 text-accent-text"
          >
            Utiliser
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={text.trim() === '' || state.kind === 'loading'}
          onClick={() => void ask()}
          className="min-h-9 cursor-pointer rounded-lg border-0 bg-transparent px-0 text-accent-text underline-offset-2 hover:underline disabled:cursor-default disabled:text-ink-faint disabled:no-underline"
        >
          {state.kind === 'loading' ? 'Traduction…' : 'Suggérer une traduction (DeepL)'}
        </button>
      )}
      {state.kind === 'error' && <span role="alert" className="text-warn">{state.message}</span>}
    </div>
  );
}
