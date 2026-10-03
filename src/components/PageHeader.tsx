import type { ReactNode } from 'react';
import { PlusIcon, SearchIcon } from './icons';

/** En-tête d'une page. Les réglages sont dans la barre d'onglets (téléphone) ou en pied de barre latérale. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 pt-[max(1.5rem,var(--page-top))] pb-4 lg:px-8 lg:pt-7 lg:pb-5">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 font-display text-3xl font-semibold tracking-tight lg:text-[32px]">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-soft">{subtitle}</div>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">{actions}</div>}
    </header>
  );
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 text-ink-soft lg:h-10 lg:w-72 lg:flex-none">
      <SearchIcon size={16} />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none lg:text-sm"
      />
    </label>
  );
}

/** Bouton d'action principal sur grand écran (sur téléphone : `FloatingAction`). */
export function HeaderAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-accent px-4 text-sm font-semibold text-white lg:inline-flex"
    >
      <PlusIcon size={16} />
      {label}
    </button>
  );
}
