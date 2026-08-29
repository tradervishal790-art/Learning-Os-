import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ExternalLink, X } from 'lucide-react';

interface ResearchSource {
  title: string;
  url: string;
}

interface ResearchResult {
  query: string;
  summary: string;
  sources: ResearchSource[];
  grounded: boolean;
}

const RESEARCH_STATE_STORAGE_KEY = 'learning_os_research_state';
const RESEARCH_CACHE_PREFIX = 'learning_os_research_cache_';

function cacheKey(query: string): string {
  return `${RESEARCH_CACHE_PREFIX}${query.trim().toLowerCase()}`;
}

async function runResearch(query: string): Promise<ResearchResult> {
  const response = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Research failed (${response.status})`);
  }

  return { query, summary: data.summary, sources: data.sources ?? [], grounded: !!data.grounded };
}

interface ResearchProps {
  /** Compact mode — used when opened alongside a playing video (VideoIntel)
   *  so the learner can research without leaving/pausing the video. Drops
   *  the full-page chrome and skips the standalone session restore. */
  embedded?: boolean;
  initialQuery?: string;
  onClose?: () => void;
}

export default function Research({ embedded = false, initialQuery, onClose }: ResearchProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Standalone mode restores the last session. Embedded mode starts fresh
  // each time (it's scoped to whatever video is open right now) but still
  // auto-searches the video's title if one was passed in.
  useEffect(() => {
    if (embedded) {
      if (initialQuery) handleSearch(initialQuery);
      return;
    }
    try {
      const saved = localStorage.getItem(RESEARCH_STATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { query: string; result: ResearchResult | null; history: string[] };
        if (parsed.query) setQuery(parsed.query);
        if (parsed.result) setResult(parsed.result);
        if (parsed.history) setHistory(parsed.history);
      }
    } catch {
      // Corrupted storage — ignore, start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (embedded) return;
    if (!query && !result) return;
    try {
      localStorage.setItem(RESEARCH_STATE_STORAGE_KEY, JSON.stringify({ query, result, history }));
    } catch {
      // Storage full/unavailable — non-critical.
    }
  }, [embedded, query, result, history]);

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;

    setLoading(true);
    setError('');
    setQuery(q);

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
          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2.5 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
        />
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => handleSearch()}
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

  const resultBlock = result && (
    <div className={embedded ? 'mt-4' : 'max-w-4xl mx-auto'}>
      <motion.div
        key={result.query}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5 ${embedded ? '' : 'md:p-8 mb-6'}`}
      >
        {!result.grounded && (
          <p className="text-xs text-gray-400 dark:text-white/40 mb-3">
            Live search source nahi mila is baar — ye general knowledge se likha gaya jawab hai, current cheezon ke liye double-check kar lena
          </p>
        )}
        <h2 className={`font-bold mb-3 ${embedded ? 'text-lg' : 'text-2xl mb-4'}`}>{result.query}</h2>
        <div className="text-gray-700 dark:text-white/80 leading-relaxed whitespace-pre-wrap text-sm">{result.summary}</div>
      </motion.div>

      {result.sources.length > 0 && (
        <div className={embedded ? 'mt-4' : 'mt-0'}>
          <h3 className="text-xs font-semibold text-gray-400 dark:text-white/40 mb-3 uppercase tracking-wide">Sources</h3>
          <div className={`grid gap-2 ${embedded ? '' : 'sm:grid-cols-2'}`}>
            {result.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-black dark:hover:border-white/30 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-white/40" />
                <div className="min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{s.title}</p>
                  <p className="text-xs text-gray-400 dark:text-white/40 truncate">{s.url}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
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
        {resultBlock}
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

      <div className="max-w-4xl mx-auto mb-6">
        {searchBar}
        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}

        {history.length > 0 && !loading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {history.map((h) => (
              <button
                key={h}
                onClick={() => handleSearch(h)}
                className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-full text-xs text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {resultBlock}

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
