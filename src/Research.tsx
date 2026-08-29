import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

export default function Research() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Restore last session on mount.
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!query && !result) return;
    try {
      localStorage.setItem(RESEARCH_STATE_STORAGE_KEY, JSON.stringify({ query, result, history }));
    } catch {
      // Storage full/unavailable — non-critical.
    }
  }, [query, result, history]);

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
      setHistory((prev) => [q, ...prev.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Research</h1>
        <p className="text-white/60">Kisi bhi topic pe live internet research — summary + sources</p>
      </motion.div>

      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Kya research karna hai?"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-white/40 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl font-semibold transition"
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>

        {error && <p className="text-yellow-400 text-sm mt-2">{error}</p>}

        {history.length > 0 && !loading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {history.map((h) => (
              <button
                key={h}
                onClick={() => handleSearch(h)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div className="max-w-4xl mx-auto">
          <motion.div
            key={result.query}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6"
          >
            {!result.grounded && (
              <p className="text-xs text-white/40 mb-3">
                ⚠ Live search source unavailable thi — ye general knowledge se generate kiya gaya jawab hai, current events ke liye reliable nahi
              </p>
            )}
            <h2 className="text-2xl font-bold mb-4">{result.query}</h2>
            <div className="text-white/80 leading-relaxed whitespace-pre-wrap">{result.summary}</div>
          </motion.div>

          {result.sources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">Sources</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 hover:border-purple-500/30 transition"
                  >
                    <p className="text-sm font-medium text-white/90 line-clamp-2">{s.title}</p>
                    <p className="text-xs text-purple-400/70 mt-1 truncate">{s.url}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="max-w-2xl mx-auto text-center py-16 text-white/60">
          <p className="text-lg mb-2">Koi bhi topic search karein — live internet se</p>
          <p className="text-sm">AI summary + real source links, dono milenge</p>
        </div>
      )}
    </div>
  );
}
