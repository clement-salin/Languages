import type { GroupMode } from '../../domain/en/phrasal';

export const MODE_SEGMENT: Record<GroupMode, string> = { verb: 'verbe', particle: 'particule' };

export function modeFromSegment(segment: string | undefined): GroupMode | null {
  if (segment === 'verbe') return 'verb';
  if (segment === 'particule') return 'particle';
  return null;
}

export const groupPath = (mode: GroupMode, key: string): string =>
  `/en/${MODE_SEGMENT[mode]}/${encodeURIComponent(key)}`;

const MODE_KEY = 'languages.en-group-mode';

export function rememberedMode(): GroupMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'particle' ? 'particle' : 'verb';
  } catch {
    return 'verb';
  }
}

export function rememberMode(mode: GroupMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Navigation privée : on reviendra au regroupement par verbe.
  }
}
