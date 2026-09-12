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

export interface DictionaryEntry {
  word: string;
  partsOfSpeech: string[];
  senses: DictionarySense[];
  ipa?: string;
  audioUrl?: string;
  level?: string;
  frequencyRank?: number;
  forms?: string[];
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
}

const DICTIONARY_URL = '/data/dictionary.json';

let dictionaryData: Record<string, RawEntry> | null = null;
let sortedWords: string[] | null = null;
let loadingPromise: Promise<Record<string, RawEntry>> | null = null;

function loadDictionary(): Promise<Record<string, RawEntry>> {
  if (dictionaryData) return Promise.resolve(dictionaryData);
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch(DICTIONARY_URL)
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
