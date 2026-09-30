import type { Auxiliary } from './core/auxiliary';
import type { ReflexiveCase } from './core/verb';

/** Un verbe enregistré dans le carnet. */
export interface SavedVerb {
  /** Infinitif tel qu'affiché, sert d'identifiant (« sich freuen », « anrufen »). */
  id: string;
  translation: string;
  notes: string;
  /** Date d'ajout (ISO 8601). */
  addedAt: string;
  /** Choix de l'utilisateur quand le verbe admet plusieurs conjugaisons. */
  auxiliary?: Auxiliary;
  reflexiveCase?: ReflexiveCase;
  separable?: boolean;
}

export const STORAGE_KEY = 'verbheft:verbs';

type Listener = (verbs: SavedVerb[]) => void;

/**
 * Carnet de verbes, conservé dans le navigateur (localStorage).
 * Les données restent sur l'appareil : l'export JSON sert de sauvegarde.
 */
export class VerbStore {
  private verbs: SavedVerb[];
  private listeners = new Set<Listener>();
  /** Faux si le navigateur refuse le stockage (navigation privée…). */
  persistent = true;

  constructor() {
    this.verbs = this.read();
  }

  all(): SavedVerb[] {
    return [...this.verbs];
  }

  get(id: string): SavedVerb | undefined {
    return this.verbs.find((v) => v.id === id);
  }

  has(id: string): boolean {
    return this.verbs.some((v) => v.id === id);
  }

  add(verb: Omit<SavedVerb, 'addedAt' | 'notes'> & Partial<Pick<SavedVerb, 'addedAt' | 'notes'>>): SavedVerb {
    const saved: SavedVerb = {
      notes: '',
      addedAt: new Date().toISOString(),
      ...verb,
    };
    this.verbs = [saved, ...this.verbs.filter((v) => v.id !== saved.id)];
    this.commit();
    return saved;
  }

  update(id: string, patch: Partial<Omit<SavedVerb, 'id'>>): void {
    this.verbs = this.verbs.map((v) => (v.id === id ? { ...v, ...patch } : v));
    this.commit();
  }

  remove(id: string): void {
    this.verbs = this.verbs.filter((v) => v.id !== id);
    this.commit();
  }

  /** Relit le stockage (modifié depuis un autre onglet). */
  reload(): void {
    this.verbs = this.read();
    for (const listener of this.listeners) listener(this.all());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private read(): SavedVerb[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw) as { verbs?: SavedVerb[] };
      return Array.isArray(data.verbs)
        ? data.verbs.map(normalizeSavedVerb).filter((v): v is SavedVerb => v !== null)
        : [];
    } catch {
      this.persistent = false;
      return [];
    }
  }

  private commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, verbs: this.verbs }));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
    for (const listener of this.listeners) listener(this.all());
  }
}

/** Valide un verbe lu depuis le stockage ou un fichier importé. */
export function normalizeSavedVerb(value: unknown): SavedVerb | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.trim() === '') return null;
  const addedAt = typeof v.addedAt === 'string' && !Number.isNaN(Date.parse(v.addedAt))
    ? v.addedAt
    : new Date().toISOString();
  return {
    id: v.id.trim(),
    translation: typeof v.translation === 'string' ? v.translation : '',
    notes: typeof v.notes === 'string' ? v.notes : '',
    addedAt,
    ...(v.auxiliary === 'haben' || v.auxiliary === 'sein' ? { auxiliary: v.auxiliary } : {}),
    ...(v.reflexiveCase === 'acc' || v.reflexiveCase === 'dat' ? { reflexiveCase: v.reflexiveCase } : {}),
    ...(typeof v.separable === 'boolean' ? { separable: v.separable } : {}),
  };
}
