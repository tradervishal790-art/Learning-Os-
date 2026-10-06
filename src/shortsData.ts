import { authFetch } from './apiFetch';
import { pullSharedSearch, pushSharedSearch } from './sharedVideoCache';
import { cacheGet, cacheSet } from './mediaCache';

// ============================================================
// shortsData.ts — one place that loads Shorts for an interest, through the
// 3 cache layers (device -> shared Firestore -> YouTube API).
// ============================================================

export interface Short {
  id: string;
  title: string;
  channel: string;
}

const norm = (interest: string) => interest.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);

export async function loadShorts(interest: string): Promise<Short[]> {
  const n = norm(interest);
  const local = cacheGet<Short[]>(`shorts_${n}`);
  if (local && local.length > 0) return local;

  const sharedKey = `search_shorts_${n}`;
  const shared = await pullSharedSearch<Short>(sharedKey);
  if (shared) {
    cacheSet(`shorts_${n}`, shared.items);
    return shared.items;
  }

  const params = new URLSearchParams({ shorts: '1', maxResults: '25', q: `${interest} shorts` });
  const res = await authFetch(`/api/youtube?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Could not load shorts');
  const items: Short[] = (data.items ?? []).map((it: any) => ({
    id: it.id.videoId,
    title: it.snippet.title,
    channel: it.snippet.channelTitle,
  }));
  if (items.length > 0) {
    cacheSet(`shorts_${n}`, items);
    pushSharedSearch(sharedKey, items, null);
  }
  return items;
}

/** Warm every cache layer in the background so the break starts instantly. */
export function prefetchShorts(interests: string[]): void {
  interests.forEach((i) => void loadShorts(i).catch(() => {}));
}
