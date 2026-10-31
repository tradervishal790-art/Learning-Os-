import { useEffect, useRef, useState } from 'react';
import { Search, Volume2, RotateCw } from 'lucide-react';
import { ensureDictionaryLoaded, lookupWord, suggestWords } from './dictionaryStore';
import type { DictionaryEntry } from './dictionaryStore';

const RECENT_KEY = 'learning_os_dictionary_recent';
const RECENT_LIMIT = 10;

export default function Dictionary() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchIdRef = useRef(0);

  const loadDictionary = () => {
    setLoading(true);
    setLoadError(false);
    void ensureDictionaryLoaded()
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDictionary();

    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecent(parsed.filter((word): word is string => typeof word === 'string').slice(0, RECENT_LIMIT));
      }
    } catch {
      // corrupted/unavailable storage — start fresh, non-critical
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    suggestWords(q).then((s) => {
      if (!cancelled) setSuggestions(s);
    }).catch(() => {
      if (!cancelled) setSuggestions([]);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const search = async (word: string) => {
    const w = word.trim();
    if (!w || loading || loadError) return;
    const requestId = ++searchIdRef.current;
    setQuery(w);
    setSuggestions([]);
    setEntry(null);
    setNotFound(false);
    setSearchError('');
    setSearching(true);

    try {
      const found = await lookupWord(w);
      if (requestId !== searchIdRef.current) return;
      if (found) {
        setEntry(found);
        setRecent((prev) => {
          const next = [w.toLowerCase(), ...prev.filter((r) => r !== w.toLowerCase())].slice(0, RECENT_LIMIT);
          try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          } catch {
            // storage full/unavailable — non-critical
          }
          return next;
        });
      } else {
        setNotFound(true);
      }
    } catch {
      if (requestId === searchIdRef.current) setSearchError('The word could not be loaded. Please try again.');
    } finally {
      if (requestId === searchIdRef.current) setSearching(false);
    }
  };

  const playAudio = () => {
    audioRef.current?.play().catch(() => {
      // autoplay blocked or network issue — non-critical
    });
  };

  // Hindi meanings across all senses, de-duplicated — shown together with Sanskrit up top.
  const hindiSummary = entry
    ? Array.from(new Set(entry.senses.flatMap((sn) => sn.hindi))).slice(0, 6)
    : [];

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl break-words [overflow-wrap:anywhere]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            searchIdRef.current += 1;
            setSearching(false);
            setQuery(e.target.value);
            setEntry(null);
            setNotFound(false);
            setSearchError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && void search(query)}
          placeholder={loading ? 'Loading dictionary…' : 'Search an English word…'}
          disabled={loading || loadError}
          autoFocus
          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-12 py-2.5 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void search(query)}
          disabled={loading || loadError || searching || !query.trim()}
          aria-label="Search dictionary"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-40"
        >
          {searching ? <span className="text-xs">…</span> : <Search className="w-4 h-4" />}
        </button>
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => search(s)}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {loadError && (
        <div className="mt-6 flex items-center gap-3 text-sm text-red-500">
          <p>Couldn't load the dictionary. Check your connection and try again.</p>
          <button type="button" onClick={loadDictionary} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-current/20 hover:bg-red-500/5">
            <RotateCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {!entry && !notFound && !loadError && recent.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-gray-500 dark:text-white/40 mb-2">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r}
                onClick={() => search(r)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-white/10 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchError && <p role="alert" className="mt-6 text-sm text-red-500">{searchError}</p>}
      {searching && <p role="status" className="mt-6 text-sm text-gray-500 dark:text-white/40">Searching…</p>}
      {notFound && (
        <p className="mt-6 text-gray-500 dark:text-white/40">No entry found for "{query}". Try another spelling.</p>
      )}

      {entry && (
        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold">{entry.word}</h2>
            {entry.ipa && <span className="text-gray-500 dark:text-white/40">/{entry.ipa}/</span>}
            {entry.audioUrl && (
              <>
                <button
                  onClick={playAudio}
                  aria-label="Play pronunciation"
                  className="p-1.5 rounded-full border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <audio ref={audioRef} src={entry.audioUrl} preload="none" />
              </>
            )}
            {entry.level && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50">
                {entry.level}
              </span>
            )}
          </div>

          <div className="rounded-lg card p-4 space-y-1">
            <p>
              <span className="text-gray-500 dark:text-white/40">Hindi: </span>
              <span className="text-lg">{hindiSummary.join(', ') || '—'}</span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-white/40">Sanskrit: </span>
              <span className="text-lg">
                {entry.sanskritMatches?.map((m) => m.devanagari).join(', ') || '—'}
              </span>
            </p>
          </div>

          <div className="space-y-4">
            {entry.senses.map((sense, i) => (
              <div key={i} className="border border-gray-200 dark:border-white/10 rounded-lg p-4">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-white/40">
                  {sense.pos}
                </span>
                {sense.definition && <p className="mt-1">{sense.definition}</p>}
                {sense.example && (
                  <p className="mt-1 text-sm italic text-gray-500 dark:text-white/50">"{sense.example}"</p>
                )}
                {sense.hindi.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-gray-500 dark:text-white/40">Hindi: </span>
                    {sense.hindi.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="border border-gray-200 dark:border-white/10 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-white/40 mb-2">Sanskrit</p>
            {entry.sanskritMatches && entry.sanskritMatches.length > 0 ? (
              <>
                <div className="space-y-2">
                  {entry.sanskritMatches.map((m, i) => (
                    <div key={i}>
                      <span className="text-lg">{m.devanagari}</span>
                      <span className="text-sm text-gray-500 dark:text-white/40"> ({m.slp1})</span>
                      {m.meaning && (
                        <span className="text-xs text-gray-400 dark:text-white/30"> · {m.meaning}</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
                  {entry.sanskritMatches[0].src === 'a'
                    ? "From Apte's Student's English–Sanskrit Dictionary (1920)."
                    : entry.sanskritMatches[0].src === 'm'
                      ? "From Monier-Williams' English–Sanskrit Dictionary (1851) — older and less precise, verify before relying on it."
                      : 'Approximate: matched through the Hindi meaning, so a rare unrelated word is possible.'}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-white/40">
                No Sanskrit equivalent found — modern words often have none in classical Sanskrit.
              </p>
            )}
          </div>

          {entry.forms && entry.forms.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-white/40">Other forms: {entry.forms.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
