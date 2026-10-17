// ============================================================
// mistakeStore.ts — the student's mistake notebook (Part 6).
// A mistake = what went wrong + the correct answer. Kept on this device
// (localStorage). Not synced to other devices yet.
// ============================================================

export interface Mistake {
  id: string;
  /** The note it came from (optional: mistakes can also be added by hand). */
  noteId?: string;
  text: string;
  fix: string;
  createdAt: string;
}

const KEY = 'learning_os_mistakes_v1';
const MAX = 500;

export function getMistakes(): Mistake[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((m): m is Mistake => !!m && typeof m.id === 'string' && typeof m.text === 'string' && typeof m.fix === 'string');
  } catch {
    return [];
  }
}

function save(list: Mistake[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    return true;
  } catch {
    return false;
  }
}

/** Newest first. Returns null when the text is empty. */
export function addMistake(input: { text: string; fix?: string; noteId?: string }): Mistake | null {
  const text = input.text.trim().slice(0, 1000);
  if (!text) return null;
  const m: Mistake = {
    id: `mk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    text,
    fix: (input.fix ?? '').trim().slice(0, 1000),
    createdAt: new Date().toISOString(),
  };
  if (input.noteId) m.noteId = input.noteId;
  return save([m, ...getMistakes()]) ? m : null;
}

export function removeMistake(id: string): void {
  save(getMistakes().filter((m) => m.id !== id));
}
