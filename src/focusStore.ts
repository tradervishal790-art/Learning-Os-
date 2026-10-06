import { pushToCloud, pullFromCloud } from './cloudSync';

// ============================================================
// focusStore.ts — Focus Player data that must follow the ACCOUNT:
// locked break settings, the Shorts bank (score) and saved Shorts.
//
// Firestore path (existing rule already covers it, no new rule needed):
//   users/{uid}/data/focusState   (via cloudSync.ts)
// localStorage stays the instant source; the cloud copy makes it survive a
// new device / cleared browser. Newer `updatedAt` wins.
// ============================================================

export interface SavedShort {
  id: string;
  title: string;
  channel: string;
  savedAt: number;
}

export interface FocusCloud {
  prefs: unknown;
  bank: unknown;
  saved: unknown;
  updatedAt: number;
}

export const SAVED_KEY = 'learning_os_focus_saved';
export const MAX_SAVED = 30;
const TS_KEY = 'learning_os_focus_state_ts';

export function sanitizeSaved(raw: unknown): SavedShort[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedShort[] = [];
  for (const r of raw) {
    if (!r || typeof r.id !== 'string' || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      title: typeof r.title === 'string' ? r.title : '',
      channel: typeof r.channel === 'string' ? r.channel : '',
      savedAt: Number(r.savedAt) || 0,
    });
    if (out.length >= MAX_SAVED) break;
  }
  return out;
}

export function loadSaved(): SavedShort[] {
  try {
    return sanitizeSaved(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export const getLocalTs = () => Number(localStorage.getItem(TS_KEY)) || 0;
export const setLocalTs = (t: number) => localStorage.setItem(TS_KEY, String(t));

export const pullFocusState = () => pullFromCloud<FocusCloud>('focusState');
export const pushFocusState = (state: FocusCloud) => void pushToCloud('focusState', state);
