import { PlusIcon } from './icons';

/**
 * Action principale d'un écran sur téléphone : un bouton rond sous le
 * pouce. Sur grand écran, la même action est un bouton d'en-tête.
 */
export function FloatingAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="fixed right-5 bottom-[calc(var(--tab-bar-height)+1rem)] z-20 flex size-14 cursor-pointer items-center justify-center rounded-full border-0 bg-accent text-white shadow-float lg:hidden"
    >
      <PlusIcon size={24} />
    </button>
  );
}
