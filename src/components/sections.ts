import type { SyncableCollection } from '../domain/sync';
import type { Lang } from '../language';
import { BranchIcon, QuoteIcon, TableIcon } from './icons';

/**
 * Les sections de chaque langue. Une section de plus = une entrée ici, une
 * route dans App.tsx et, si elle stocke des données, une collection
 * synchronisée.
 */
export interface Section {
  to: string;
  label: string;
  icon: typeof TableIcon;
  /** Collection dont le nombre d'enregistrements s'affiche à côté du nom. */
  collection: SyncableCollection;
  /** La section est-elle celle de cette adresse ? Ses sous-pages comprises. */
  matches: (pathname: string) => boolean;
}

const under = (prefix: string) => (pathname: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export const SECTIONS: Record<Lang, Section[]> = {
  de: [{ to: '/de', label: 'Conjugaison', icon: TableIcon, collection: 'deVerbs', matches: under('/de') }],
  en: [
    {
      to: '/en',
      label: 'Phrasal verbs',
      icon: BranchIcon,
      collection: 'enPhrasals',
      // Les phrasal verbs occupent /en et /en/<regroupement>/<clé> : tout
      // /en sauf les expressions.
      matches: (pathname) => under('/en')(pathname) && !under('/en/expressions')(pathname),
    },
    { to: '/en/expressions', label: 'Expressions', icon: QuoteIcon, collection: 'enExpressions', matches: under('/en/expressions') },
  ],
};
