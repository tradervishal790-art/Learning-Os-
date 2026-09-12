import { useEffect, useRef, useState } from 'react';
import { Search, Volume2 } from 'lucide-react';
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
  const [recent, setRecent] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    ensureDictionaryLoaded()
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));

    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) setRecent(JSON.parse(saved));
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
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const search = async (word: string) => {
    const w = word.trim();
    if (!w) return;
    setQuery(w);
    setSuggestions([]);

    const found = await lookupWord(w);
    if (found) {
      setEntry(found);
      setNotFound(false);
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
      setEntry(null);
      setNotFound(true);
    }
  };

  const playAudio = () => {
    audioRef.current?.play().catch(() => {
      // autoplay blocked or network issue — non-critical
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(query)}
          placeholder={loading ? 'Loading dictionary…' : 'Search an English word…'}
          disabled={loading || loadError}
          autoFocus
          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2.5 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white disabled:opacity-50"
        />
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
        <p className="mt-6 text-red-500">
          Couldn't load the dictionary. Check your connection and reload the page.
        </p>
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

      {notFound && (
        <p className="mt-6 text-gray-500 dark:text-white/40">No entry found for "{query}".</p>
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

          {entry.forms && entry.forms.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-white/40">Other forms: {entry.forms.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
