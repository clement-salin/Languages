/** Icônes au trait, en SVG, qui prennent la couleur du texte. */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const TableIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10M15 10v10" /></Icon>
);
export const BranchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="6" cy="12" r="2.5" /><path d="M8.5 12H13M13 12l5-5M13 12h6M13 12l5 5" /></Icon>
);
export const SyncIcon = (p: IconProps) => (
  <Icon {...p}><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1" /><path d="M18 3v4.5h-4.5M6 21v-4.5h4.5" /></Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const BackIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="m15 18-6-6 6-6" /></Icon>
);
export const ChevronIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="m9 18 6-6-6-6" /></Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);
export const QuoteIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M9 9.5h6M9 12.5h4" /></Icon>
);
export const FilterIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>
);
