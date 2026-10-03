import { applyUpdate } from '../pwa';

/**
 * Bandeau de mise à jour. Une nouvelle version ne s'installe jamais sous
 * les doigts de l'utilisateur : elle attend qu'il l'accepte. Recharger
 * pendant qu'il écrit une note lui ferait perdre sa saisie.
 */
export function UpdateBanner() {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--lang-bar-height)+1rem)] z-30 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
    >
      <p className="m-0 flex-1 text-sm text-ink-2">Une nouvelle version est disponible.</p>
      <button
        type="button"
        onClick={applyUpdate}
        className="min-h-9 shrink-0 cursor-pointer rounded-lg border-0 bg-ink-2 px-3.5 text-sm font-semibold text-white"
      >
        Recharger
      </button>
    </div>
  );
}
