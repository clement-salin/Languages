import { useEffect, useState } from 'react';
import { canTranslate, suggestTranslation, TranslateError, type Lang } from '../data/translate';

/** Ce que l'appelant fait d'une traduction brute avant de la proposer. */
export interface CheckedSuggestion {
  /** Valeur proposée (éventuellement remise en forme). */
  value: string;
  /** Faux si la proposition ne peut pas être retenue telle quelle. */
  usable: boolean;
  /** Précision affichée à côté (« absent du dictionnaire »…). */
  note?: string;
}

/**
 * Propose une traduction DeepL à côté d'un champ.
 *
 * **Une proposition, jamais un remplissage** : la traduction s'affiche avec
 * un bouton « Utiliser » ; rien n'entre dans le champ sans ce geste. Une
 * traduction automatique d'un mot isolé se trompe souvent de sens.
 *
 * Absent sur un appareil sans jeton de synchronisation : le bouton ne
 * pourrait qu'échouer.
 */
export function TranslationSuggestion({
  text,
  source,
  target = 'FR',
  label = 'Suggérer une traduction (DeepL)',
  check,
  onUse,
}: {
  /** Ce qu'il faut traduire ; vide tant que la saisie ne permet rien. */
  text: string;
  source: Lang;
  target?: Lang;
  label?: string;
  /** Vérifie et remet en forme la traduction avant de la proposer. */
  check?: (translation: string) => CheckedSuggestion;
  onUse: (value: string) => void;
}) {
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'done'; for: string; suggestion: CheckedSuggestion }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // Une suggestion faite pour un autre texte n'a plus cours.
  useEffect(() => {
    setState((s) => (s.kind === 'done' && s.for !== text ? { kind: 'idle' } : s.kind === 'error' ? { kind: 'idle' } : s));
  }, [text]);

  if (!canTranslate()) return null;

  async function ask(): Promise<void> {
    setState({ kind: 'loading' });
    try {
      const raw = await suggestTranslation(text, source, target);
      setState({ kind: 'done', for: text, suggestion: check ? check(raw) : { value: raw, usable: true } });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof TranslateError ? error.message : 'Suggestion impossible.' });
    }
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {state.kind === 'done' ? (
        <>
          <span className="text-ink-soft">DeepL propose :</span>
          <span lang={target.toLowerCase()} className="font-medium text-ink-2">« {state.suggestion.value} »</span>
          {state.suggestion.note && <span className="text-warn">{state.suggestion.note}</span>}
          {state.suggestion.usable && (
            <button
              type="button"
              onClick={() => {
                onUse(state.suggestion.value);
                setState({ kind: 'idle' });
              }}
              className="min-h-9 cursor-pointer rounded-lg border border-line-strong bg-surface px-3 text-accent-text"
            >
              Utiliser
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={text.trim() === '' || state.kind === 'loading'}
          onClick={() => void ask()}
          className="min-h-9 cursor-pointer rounded-lg border-0 bg-transparent px-0 text-accent-text underline-offset-2 hover:underline disabled:cursor-default disabled:text-ink-faint disabled:no-underline"
        >
          {state.kind === 'loading' ? 'Traduction…' : label}
        </button>
      )}
      {state.kind === 'error' && <span role="alert" className="text-warn">{state.message}</span>}
    </div>
  );
}
