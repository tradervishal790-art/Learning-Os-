import type { CAPoint } from './currentAffairsStore';

/**
 * Saved Current Affairs points ("Save" on a card). localStorage only — a
 * small personal bookmark list, newest first, capped so it can't grow forever.
 */
const KEY = 'learning_os_ca_saved';
const MAX_SAVED = 100;

export interface SavedPoint extends CAPoint {
  date: string;
  savedAt: number;
}

export const savedKey = (date: string, p: Pick<CAPoint, 'text'>) => `${date}::${p.text}`;

export function loadSaved(): SavedPoint[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedPoint => !!x && typeof x.text === 'string' && typeof x.date === 'string' && typeof x.category === 'string',
    );
  } catch {
    return [];
  }
}

/** Adds the point if it isn't saved yet, removes it if it is. Returns the new list. */
export function toggleSaved(date: string, point: CAPoint): SavedPoint[] {
  const list = loadSaved();
  const key = savedKey(date, point);
  const exists = list.some((s) => savedKey(s.date, s) === key);
  const next = exists
    ? list.filter((s) => savedKey(s.date, s) !== key)
    : [{ ...point, date, savedAt: Date.now() }, ...list].slice(0, MAX_SAVED);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* best effort */
  }
  return next;
}
