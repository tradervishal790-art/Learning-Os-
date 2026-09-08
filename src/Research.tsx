import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import HintBubble from './HintBubble';

interface SerpResult {
  title: string;
  url: string;
  snippet: string;
}

interface ResearchResponse {
  query: string;
  results: SerpResult[];
  grounded: boolean;
}

const RESEARCH_STATE_STORAGE_KEY = 'learning_os_research_state';
const RESEARCH_CACHE_PREFIX = 'learning_os_research_cache_';

function cacheKey(query: string): string {
  return `${RESEARCH_CACHE_PREFIX}${query.trim().toLowerCase()}`;
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

async function runResearch(query: string): Promise<ResearchResponse> {
  const response = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Research failed (${response.status})`);
  }

  return { query, results: data.results ?? [], grounded: !!data.grounded };
}

interface ResearchProps {
  /** Compact mode — used when opened alongside a playing video (VideoIntel)
   *  so the learner can research without leaving/pausing the video. Opens
   *  as a blank search space every time — it does NOT auto-search the
   *  video's title, since the point is a free research space, not a
   *  pre-filled "about this video" lookup. */
  embedded?: boolean;
  onClose?: () => void;
}

export default function Research({ embedded = false, onClose }: ResearchProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Standalone mode restores the last session. Embedded mode always opens
  // as a blank search space (see ResearchProps.embedded doc above).
  useEffect(() => {
    if (embedded) return;
    try {
      const saved = localStorage.getItem(RESEARCH_STATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { query: string; result: ResearchResponse | null; history: string[] };
        if (parsed.query) setQuery(parsed.query);
        if (parsed.result) setResult(parsed.result);
        if (parsed.history) setHistory(parsed.history);
      }
    } catch {
      // Corrupted storage — ignore, start fresh.
    }
  }, [embedded]);

  useEffect(() => {
    if (embedded) return;
    if (!query && !result) return;
    try {
      localStorage.setItem(RESEARCH_STATE_STORAGE_KEY, JSON.stringify({ query, result, history }));
    } catch {
      // Storage full/unavailable — non-critical.
    }
  }, [embedded, query, result, history]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError('');

    try {
      const cached = localStorage.getItem(cacheKey(q));
      if (cached) {
        setResult(JSON.parse(cached));
        setLoading(false);
        return;
      }

      const res = await runResearch(q);
      localStorage.setItem(cacheKey(q), JSON.stringify(res));
      setResult(res);
      if (!embedded) {
        setHistory((prev) => [q, ...prev.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 8));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  };

  const searchBar = (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Kya jaanna hai?"
          autoFocus={embedded}
          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2.5 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
        />
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="flex-1 px-5 py-2.5 bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 rounded-lg font-semibold transition"
        >
          {loading ? '...' : 'Search'}
        </button>
        {embedded && onClose && (
          <button
            onClick={onClose}
            className="px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition"
            aria-label="Close research panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  // Renders like a search-engine results page: title link, url line,
  // snippet — one card per source, instead of one AI-written essay.
  const resultsBlock = result && result.results.length > 0 && (
    <div className={embedded ? 'mt-4 space-y-4' : 'max-w-3xl mx-auto space-y-5'}>
      {!result.grounded && (
        <p className="text-xs text-gray-400 dark:text-white/40">
          Live search source nahi mila is baar — neeche wala jawab general knowledge se hai, current cheezon ke liye double-check kar lena
        </p>
      )}
      {result.results.map((r, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
          {r.url ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="group block">
              <p className="text-xs text-gray-400 dark:text-white/40 truncate mb-0.5">{displayUrl(r.url)}</p>
              <h3 className="text-base font-medium underline-offset-2 group-hover:underline">{r.title}</h3>
            </a>
          ) : (
            <h3 className="text-base font-medium">{r.title}</h3>
          )}
          <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed mt-1">{r.snippet}</p>
        </motion.div>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4" />
          <h3 className="font-semibold text-sm">Research (video ke saath saath)</h3>
        </div>
        {searchBar}
        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
        {resultsBlock}
        {!result && !loading && (
          <p className="text-sm text-gray-400 dark:text-white/40 mt-4">Kuch bhi search karo — video chalti rahegi.</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Search className="w-8 h-8" /> Research
        </h1>
        <p className="text-gray-500 dark:text-white/60">Koi bhi topic search karo — internet se</p>
      </motion.div>

      <div className="max-w-3xl mx-auto mb-6">
        <HintBubble id="research" text="Deeper reading on this topic, only if you want to go further." />
        {searchBar}
        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}

        {history.length > 0 && !loading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {history.map((h) => (
              <button
                key={h}
                onClick={() => {
                  setQuery(h);
                  setTimeout(handleSearch, 0);
                }}
                className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-full text-xs text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {resultsBlock}

      {!result && !loading && (
        <div className="max-w-2xl mx-auto text-center py-16 text-gray-400 dark:text-white/60">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg mb-2">Koi bhi topic search karo</p>
          <p className="text-sm">Video dekhte hue side mein bhi khol sakte ho — Videos page se</p>
        </div>
      )}
    </div>
  );
}
