import type { Lang } from '../language';

/**
 * Drapeau de la langue, dessiné en SVG plutôt qu'en emoji : un emoji
 * drapeau s'affiche en lettres (« DE ») sous Windows. Le Royaume-Uni
 * représente l'anglais.
 */
export function Flag({ lang, onAccent = false }: { lang: Lang; onAccent?: boolean }) {
  // Un liseré pour détacher le drapeau de son fond ; blanc sur un aplat coloré.
  const ring = onAccent ? 'shadow-[0_0_0_1px_rgb(255_255_255/0.9)]' : 'shadow-[0_0_0_1px_rgb(27_26_23/0.18)]';
  if (lang === 'de') {
    return (
      <svg width="21" height="14" viewBox="0 0 5 3" preserveAspectRatio="none" aria-hidden="true" className={`shrink-0 rounded-[2px] ${ring}`}>
        <rect width="5" height="1" fill="#000000" />
        <rect y="1" width="5" height="1" fill="#DD0000" />
        <rect y="2" width="5" height="1" fill="#FFCE00" />
      </svg>
    );
  }
  return (
    <svg width="21" height="14" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true" className={`shrink-0 rounded-[2px] ${ring}`}>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30 0V30M0 15H60" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
