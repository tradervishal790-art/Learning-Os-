// ============================================================
// mediaCache.ts — small per-device TTL cache for video/short lists.
//
// Cache layers used by the Focus Player (fastest first):
//   1. this file (localStorage, per device, short TTL)  -> instant, 0 network
//   2. shared Firestore cache (sharedVideoCache.ts)      -> 0 YouTube quota
//   3. YouTube Data API                                   -> costs quota
// Oldest entries are evicted so localStorage never grows without limit.
// ============================================================

const PREFIX = 'lo_mc_';
const INDEX_KEY = 'lo_mc_index';
const MAX_ENTRIES = 60;

export const MEDIA_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function cacheGet<T>(key: string, ttlMs: number = MEDIA_TTL_MS): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as { t: number; v: T };
    if (typeof t !== 'number' || Date.now() - t > ttlMs) return null;
    return v;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
    const index: string[] = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]').filter((k: string) => k !== key);
    index.push(key);
    while (index.length > MAX_ENTRIES) {
      const old = index.shift();
      if (old) localStorage.removeItem(PREFIX + old);
    }
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Storage full or unavailable — caching is best-effort.
  }
}
