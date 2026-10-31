import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import { authFetch } from './apiFetch';
import { displayResearchUrl, isSafeExternalUrl, normalizeResearchResponse } from './researchUtils';
import type { ResearchResponse } from './researchUtils';

const RESEARCH_STATE_STORAGE_KEY = 'learning_os_research_state';
const RESEARCH_CACHE_PREFIX = 'learning_os_research_cache_';

function cacheKey(query: string, locale: string): string {
  return `${RESEARCH_CACHE_PREFIX}${locale}_${query.trim().toLowerCase()}`;
}

async function runResearch(query: string, genericErrorMsg: string, locale: string): Promise<ResearchResponse> {
  const response = await authFetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, locale }),
  });

  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : `${genericErrorMsg} (${response.status})`;
    throw new Error(message);
  }

  const normalized = normalizeResearchResponse(data, query);
  if (!normalized) throw new Error(genericErrorMsg);
  return normalized;
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
  const t = useTranslation();
  const { locale } = useLanguage();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    setLoading(false);
    return () => { requestIdRef.current += 1; };
  }, [locale, embedded]);

  // Standalone mode restores the last session. Embedded mode always opens
  // as a blank search space (see ResearchProps.embedded doc above).
  useEffect(() => {
    if (embedded) return;
    try {
      const saved = localStorage.getItem(RESEARCH_STATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { query?: unknown; result?: unknown; history?: unknown };
        if (typeof parsed.query === 'string') setQuery(parsed.query);
        if (Array.isArray(parsed.history)) {
          setHistory(parsed.history.filter((word): word is string => typeof word === 'string' && !!word.trim()).slice(0, 8));
        }
        if (typeof parsed.query === 'string' && parsed.result) {
          setResult(normalizeResearchResponse(parsed.result, parsed.query));
        }
      }
    } catch {
      // Corrupted storage — ignore, start fresh.
    }
  }, [embedded]);

  useEffect(() => {
    if (embedded) return;
    if (!query && !result && history.length === 0) return;
    try {
      localStorage.setItem(RESEARCH_STATE_STORAGE_KEY, JSON.stringify({ query, result, history }));
    } catch {
      // Storage full/unavailable — non-critical.
    }
  }, [embedded, query, result, history]);

  const handleSearch = async (requestedQuery = query) => {
    const q = requestedQuery.trim();
    if (!q) return;

    // A newer search always supersedes an older one, including searches
    // started with Enter while a previous request is still in flight.
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let cached: string | null = null;
      const key = cacheKey(q, locale);
      try {
        cached = localStorage.getItem(key);
      } catch {
        // Private browsing or storage limits must not block a live search.
      }
      if (cached) {
        let parsedCache: unknown = null;
        try {
          parsedCache = JSON.parse(cached);
        } catch {
          // Remove malformed JSON so it cannot poison the next visit.
        }
        const normalized = normalizeResearchResponse(parsedCache, q);
        if (normalized) {
          if (requestId === requestIdRef.current) {
            setResult(normalized);
            if (!embedded) setHistory((prev) => [q, ...prev.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 8));
          }
          return;
        }
        try {
          localStorage.removeItem(key);
        } catch {
          // Cache cleanup is best-effort.
        }
      }

      const res = await runResearch(q, t.research.genericError, locale);
      try {
        localStorage.setItem(key, JSON.stringify(res));
      } catch {
        // Results remain usable even when the browser cannot persist cache.
      }
      if (requestId === requestIdRef.current) {
        setResult(res);
        if (!embedded) {
          setHistory((prev) => [q, ...prev.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 8));
        }
      }
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err instanceof Error ? err.message : t.research.genericError);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const updateQuery = (value: string) => {
    // Editing the search invalidates the previous result immediately; a late
    // response must never appear under a different query in the input.
    requestIdRef.current += 1;
    setQuery(value);
    setResult(null);
    setError('');
    setLoading(false);
  };

  const searchBar = (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
          placeholder={t.research.searchPlaceholder}
          autoFocus={embedded}
          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2.5 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
        />
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          className="flex-1 px-5 py-2.5 bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white disabled:opacity-40 rounded-lg font-semibold transition"
        >
          {loading ? '...' : t.research.searchCta}
        </button>
        {embedded && onClose && (
          <button
            onClick={onClose}
            className="px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition"
            aria-label={t.research.closeAria}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  // Renders like a search-engine results page: title link, url line,
  // snippet — one card per source, instead of one AI-written essay.
  const resultsBlock = result && (
    result.results.length === 0 ? (
      <p role="status" className="mt-6 text-sm text-gray-500 dark:text-white/50">No results found. Try a different search phrase.</p>
    ) : (
      <div className={embedded ? 'mt-4 space-y-4' : 'max-w-3xl mx-auto space-y-5'}>
        {!result.grounded && (
          <p className="text-xs text-gray-400 dark:text-white/40">
            {t.research.notGroundedNote}
          </p>
        )}
        {result.results.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            {r.url && isSafeExternalUrl(r.url) ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="group block">
                <p className="text-xs text-gray-400 dark:text-white/40 truncate mb-0.5">{displayResearchUrl(r.url)}</p>
                <h3 className="text-base font-medium underline-offset-2 group-hover:underline">{r.title}</h3>
              </a>
            ) : (
              <h3 className="text-base font-medium">{r.title}</h3>
            )}
            <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed mt-1">{r.snippet}</p>
          </motion.div>
        ))}
      </div>
    )
  );

  if (embedded) {
    return (
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4" />
          <h3 className="font-semibold text-sm">{t.research.embedded.title}</h3>
        </div>
        {searchBar}
        {error && <p role="alert" className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
        {loading && <p role="status" className="text-sm text-gray-400 dark:text-white/40 mt-3">Searching…</p>}
        {resultsBlock}
        {!result && !loading && !error && (
          <p className="text-sm text-gray-400 dark:text-white/40 mt-4">{t.research.embedded.hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh text-black dark:text-white p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-5 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2 flex items-center gap-3">
          <Search className="w-6 h-6 md:w-8 md:h-8" /> {t.research.header.title}
        </h1>
        <p className="text-sm md:text-base text-gray-500 dark:text-white/60">{t.research.header.subtitle}</p>
      </motion.div>

      <div className="max-w-3xl mx-auto mb-6">
        {searchBar}
        {error && <p role="alert" className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
        {loading && <p role="status" className="text-sm text-gray-400 dark:text-white/40 mt-3">Searching…</p>}

        {history.length > 0 && !loading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {history.map((h) => (
              <button
                key={h}
                onClick={() => {
                  updateQuery(h);
                  void handleSearch(h);
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

      {!result && !loading && !error && (
        <div className="max-w-2xl mx-auto text-center py-16 text-gray-400 dark:text-white/60">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg mb-2">{t.research.emptyState.title}</p>
          <p className="text-sm">{t.research.emptyState.subtitle}</p>
        </div>
      )}
    </div>
  );
}
