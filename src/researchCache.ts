export interface ResearchResultItem {
  title: string;
  url: string;
  snippet: string;
}
export interface ResearchResponseData {
  query: string;
  results: ResearchResultItem[];
  grounded: boolean;
}
interface CacheEntry {
  savedAt: number;
  response: ResearchResponseData;
}
type CacheRecord = Record<string, CacheEntry>;

const CACHE_KEY = 'learning_os_research_cache_v2';
const LEGACY_CACHE_PREFIX = 'learning_os_research_cache_';
export const RESEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const RESEARCH_CACHE_LIMIT = 12;
const HISTORY_LIMIT = 8;
const QUERY_LIMIT = 200;

export function researchCacheKey(query: string, locale: string): string {
  return `${locale.trim().toLowerCase()}:${query.trim().replace(/\\s+/g, ' ').toLowerCase()}`;
}

export function isSafeResearchUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function normalizeResearchResponse(value: unknown, requestedQuery: string): ResearchResponseData | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { results?: unknown; grounded?: unknown };
  if (!Array.isArray(raw.results)) return null;
  const results = raw.results.slice(0, 20).flatMap((item): ResearchResultItem[] => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { title?: unknown; url?: unknown; snippet?: unknown };
    const title = typeof row.title === 'string' ? row.title.trim().slice(0, 300) : '';
    const snippet = typeof row.snippet === 'string' ? row.snippet.trim().slice(0, 1600) : '';
    const url = isSafeResearchUrl(row.url) ? row.url : '';
    if (!title && !snippet) return [];
    return [{ title: title || url, url, snippet }];
  });
  return {
    query: requestedQuery.trim().slice(0, QUERY_LIMIT),
    results,
    grounded: raw.grounded === true,
  };
}

export function normalizeResearchHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const query = item.trim().replace(/\\s+/g, ' ').slice(0, QUERY_LIMIT);
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    result.push(query);
    if (result.length >= HISTORY_LIMIT) break;
  }
  return result;
}

function readCacheRecord(storage: Storage, now: number): CacheRecord {
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: CacheRecord = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const entry = value as CacheEntry;
      if (!Number.isFinite(entry.savedAt) || now - entry.savedAt < 0 || now - entry.savedAt > RESEARCH_CACHE_TTL_MS) continue;
      const response = normalizeResearchResponse(entry.response, entry.response?.query ?? '');
      if (response) clean[key] = { savedAt: entry.savedAt, response };
    }
    return clean;
  } catch {
    return {};
  }
}

export function readResearchCache(storage: Storage, query: string, locale: string, now = Date.now()): ResearchResponseData | null {
  const record = readCacheRecord(storage, now);
  return record[researchCacheKey(query, locale)]?.response ?? null;
}

/** A single bounded cache replaces the old unbounded one-key-per-query storage. */
export function writeResearchCache(
  storage: Storage,
  query: string,
  locale: string,
  response: ResearchResponseData,
  now = Date.now(),
): void {
  try {
    const record = readCacheRecord(storage, now);
    record[researchCacheKey(query, locale)] = {
      savedAt: now,
      response: { ...response, query: query.trim().slice(0, QUERY_LIMIT) },
    };
    const keep = Object.entries(record)
      .sort((a, b) => b[1].savedAt - a[1].savedAt)
      .slice(0, RESEARCH_CACHE_LIMIT);
    storage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
    // Remove legacy per-query keys left by earlier versions so storage stays bounded.
    const legacyKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(LEGACY_CACHE_PREFIX) && key !== CACHE_KEY) legacyKeys.push(key);
    }
    legacyKeys.forEach((key) => storage.removeItem(key));
  } catch {
    // Cache is an optimization; a storage quota error must not break research.
  }
}
