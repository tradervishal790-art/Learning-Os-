// Client-side English–Hindi dictionary: fetches the pre-built static JSON
// once (public/data/dictionary.json, ~19MB — served gzip/brotli-compressed
// over the wire by Vercel automatically, no client decompression needed),
// keeps it in memory for the session, and exposes lookup + prefix-suggest
// helpers. See /mnt/user-data/outputs/README.md (project chat) for the
// merge sources and schema this file was built from.

export interface DictionarySense {
  pos: string;
  definition: string;
  example: string;
  hindi: string[];
}

export interface SanskritMatch {
  devanagari: string;
  slp1: string;
  meaning: string;
}

export interface DictionaryEntry {
  word: string;
  partsOfSpeech: string[];
  senses: DictionarySense[];
  ipa?: string;
  audioUrl?: string;
  level?: string;
  frequencyRank?: number;
  forms?: string[];
  /** Best-effort English->Sanskrit suggestions (see sk field below) — computed
   *  from keyword frequency over the 1899 Monier-Williams dictionary, so
   *  treat as approximate, not authoritative. Always show as "suggestions". */
  sanskritMatches?: SanskritMatch[];
}

interface RawEntry {
  '': string;
  p: string[];
  d?: string[];
  e?: string[];
  sp: string[];
  h: string[][];
  f?: string[];
  i?: string;
  a?: string;
  l?: string;
  fr?: number;
  sk?: { deva: string; slp1: string; meaning: string }[];
}

// Bump DICTIONARY_VERSION whenever public/data/dictionary.json is rebuilt.
// The version is part of the URL, so (a) the browser/CDN can cache the file
// as "immutable" and (b) our own persistent cache below is invalidated
// automatically — old versions are deleted the next time a new one is stored.
const DICTIONARY_VERSION = '1';
const DICTIONARY_URL = `/data/dictionary.json?v=${DICTIONARY_VERSION}`;
const DATA_CACHE = 'learning-os-data-v1';

let dictionaryData: Record<string, RawEntry> | null = null;
let sortedWords: string[] | null = null;
let loadingPromise: Promise<Record<string, RawEntry>> | null = null;

/** Saves the response in the persistent Cache API (survives restarts, works
 *  offline) and drops entries from older dictionary versions. */
async function storeDictionary(cache: Cache, res: Response): Promise<void> {
  const current = new URL(DICTIONARY_URL, location.origin).href;
  await cache.put(DICTIONARY_URL, res);
  const keys = await cache.keys();
  await Promise.all(keys.filter((k) => k.url !== current).map((k) => cache.delete(k)));
}

/** Cache-first: the ~20MB file is downloaded once per device, then served
 *  from local storage on every later visit. Any cache failure (private
 *  mode, quota, unsupported browser) silently falls back to plain network. */
async function fetchDictionaryResponse(): Promise<Response> {
  let cache: Cache | null = null;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open(DATA_CACHE);
      const hit = await cache.match(DICTIONARY_URL);
      if (hit) return hit;
    } catch {
      cache = null;
    }
  }
  const res = await fetch(DICTIONARY_URL);
  if (res.ok && cache) void storeDictionary(cache, res.clone()).catch(() => {});
  return res;
}

function loadDictionary(): Promise<Record<string, RawEntry>> {
  if (dictionaryData) return Promise.resolve(dictionaryData);
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetchDictionaryResponse()
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load dictionary (${res.status})`);
      return res.json() as Promise<Record<string, RawEntry>>;
    })
    .then((data) => {
      dictionaryData = data;
      sortedWords = Object.keys(data).sort();
      return data;
    })
    .catch((err) => {
      loadingPromise = null; // allow retry on next call
      throw err;
    });

  return loadingPromise;
}

/** Downloads the dictionary into the persistent cache WITHOUT parsing it
 *  (no 20MB JSON in memory), so the first real lookup is instant. */
export async function warmDictionaryCache(): Promise<void> {
  if (dictionaryData || loadingPromise || typeof caches === 'undefined') return;
  const cache = await caches.open(DATA_CACHE);
  if (await cache.match(DICTIONARY_URL)) return;
  const res = await fetch(DICTIONARY_URL);
  if (res.ok) await storeDictionary(cache, res);
}

export function isDictionaryLoaded(): boolean {
  return dictionaryData !== null;
}

export async function ensureDictionaryLoaded(): Promise<void> {
  await loadDictionary();
}

function toEntry(raw: RawEntry): DictionaryEntry {
  const senses: DictionarySense[] = raw.sp.map((pos, i) => ({
    pos,
    definition: raw.d?.[i] || '',
    example: raw.e?.[i] || '',
    hindi: raw.h?.[i] || [],
  }));
  return {
    word: raw[''],
    partsOfSpeech: raw.p,
    senses,
    ipa: raw.i,
    audioUrl: raw.a,
    level: raw.l,
    frequencyRank: raw.fr,
    forms: raw.f,
    sanskritMatches: raw.sk?.map((m) => ({ devanagari: m.deva, slp1: m.slp1, meaning: m.meaning })),
  };
}

export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  const data = await loadDictionary();
  const key = word.trim().toLowerCase();
  const raw = data[key];
  return raw ? toEntry(raw) : null;
}

/** Prefix autocomplete over the ~75k headwords using binary search on a
 *  sorted key array — fast enough for keystroke-by-keystroke suggestions
 *  without any external search library. */
export async function suggestWords(prefix: string, limit = 8): Promise<string[]> {
  await loadDictionary();
  if (!sortedWords) return [];
  const p = prefix.trim().toLowerCase();
  if (!p) return [];

  let lo = 0;
  let hi = sortedWords.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedWords[mid] < p) lo = mid + 1;
    else hi = mid;
  }

  const results: string[] = [];
  for (let i = lo; i < sortedWords.length && results.length < limit; i++) {
    if (sortedWords[i].startsWith(p)) results.push(sortedWords[i]);
    else break;
  }
  return results;
}
