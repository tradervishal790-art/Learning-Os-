import { useSyncExternalStore } from 'react';
import type { InkStroke } from './notebookStore';

// Copied handwriting. Lives in memory, so it can be pasted into another page or another note
// during the same session (it is cleared when the app is reloaded).

let clip: InkStroke[] = [];
let pastes = 0;
const listeners = new Set<() => void>();

export function setClipboard(strokes: InkStroke[]): void {
  clip = strokes.map((s) => ({ ...s }));
  pastes = 0;
  listeners.forEach((l) => l());
}

export const getClipboard = (): InkStroke[] => clip;

/** Each paste lands a bit further down-right so copies never hide each other. */
export function nextPasteOffset(): number {
  pastes += 1;
  return 24 * pastes;
}

export function useClipboardCount(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => clip.length,
    () => clip.length
  );
}
