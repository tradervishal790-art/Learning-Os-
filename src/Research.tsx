import { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import { authFetch } from './apiFetch';
import { isSafeResearchUrl, normalizeResearchHistory, normalizeResearchResponse, readResearchCache, writeResearchCache } from './researchCache';

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
function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

const NODE_COLORS = ['#a78bfa', '#67e8f9', '#6ee7b7', '#fbbf24', '#e879f9'];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The search's sources drawn as a small network: the query in the middle, one node per source,
 *  dashed links between sources from the same site. Hovering a node highlights its card below. */
function ResultMap({ query, results, activeIdx, onActive, onPick, ariaLabel }: {
  query: string;
  results: SerpResult[];
  activeIdx: number | null;
  onActive: (i: number | null) => void;
  onPick: (i: number) => void;
  ariaLabel: string;
}) {
  const reduce = useReducedMotion();
  const cx = 320;
  const cy = 150;
  const hosts = results.map((r) => hostOf(r.url));
  const uniqueHosts = Array.from(new Set(hosts.filter(Boolean)));
  const colorOf = (i: number) => NODE_COLORS[Math.max(0, uniqueHosts.indexOf(hosts[i])) % NODE_COLORS.length];
  const nodes = results.map((r, i) => {
    const angle = -Math.PI / 2 + (i / results.length) * Math.PI * 2;
    return { i, r, x: cx + Math.cos(angle) * 235, y: cy + Math.sin(angle) * 100, color: colorOf(i), host: hosts[i] };
  });
  const links: [number, number][] = [];
  hosts.forEach((h, a) => {
    if (!h) return;
    for (let b = a + 1; b < hosts.length; b += 1) if (hosts[b] === h) links.push([a, b]);
  });
  const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

  return (
    <svg viewBox="0 0 640 300" className="h-auto w-full" role="group" aria-label={ariaLabel}>
      {links.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={nodes[a].color} strokeOpacity={0.45} strokeDasharray="4 5" />
      ))}
      {nodes.map((n) => (
        <motion.line
          key={`edge-${n.i}`}
          x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke={n.color}
          strokeOpacity={activeIdx === null || activeIdx === n.i ? 0.7 : 0.18}
          strokeWidth={activeIdx === n.i ? 2.2 : 1.2}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: n.i * 0.05, duration: 0.5 }}
        />
      ))}
      <circle cx={cx} cy={cy} r={34} fill="#a78bfa" fillOpacity={0.14} />
      <circle cx={cx} cy={cy} r={24} fill="#a78bfa" style={{ filter: 'drop-shadow(0 0 12px rgba(167,139,250,.8))' }} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0b1221">{short(query, 9)}</text>
      {nodes.map((n) => {
        const active = activeIdx === n.i;
        const above = n.y < cy;
        return (
          <g
            key={`node-${n.i}`}
            role="button"
            tabIndex={0}
            aria-label={`${n.i + 1}. ${n.r.title}`}
            className="cursor-pointer outline-none"
            onMouseEnter={() => onActive(n.i)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(n.i)}
            onBlur={() => onActive(null)}
            onClick={() => onPick(n.i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(n.i); } }}
          >
            <circle cx={n.x} cy={n.y} r={active ? 19 : 15} fill={n.color} fillOpacity={active ? 0.35 : 0.18} stroke={n.color} strokeWidth={active ? 2 : 1.2}
              style={{ filter: active ? `drop-shadow(0 0 10px ${n.color})` : undefined, transition: 'r 150ms, fill-opacity 150ms' }} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={n.color}>{n.i + 1}</text>
            <text x={n.x} y={above ? n.y - 24 : n.y + 32} textAnchor="middle" fontSize="10" fill="#94a3b8" className="hidden sm:inline">{short(n.host, 22)}</text>
          </g>
        );
      })}
    </svg>
  );
}

async function runResearch(query: string, genericErrorMsg: string, locale: string): Promise<ResearchResponse> {
  const response = await authFetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, locale }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `${genericErrorMsg} (${response.status})`);
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
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    setLoading(false);
    setResult(null);
    setError('');
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
        if (typeof parsed.query === 'string') setQuery(parsed.query.slice(0, 200));
        const restored = normalizeResearchResponse(parsed.result, typeof parsed.query === 'string' ? parsed.query : '');
        if (restored) setResult(restored);
        setHistory(normalizeResearchHistory(parsed.history));
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

  const handleSearch = async (requestedQuery = query) => {
    const q = requestedQuery.trim().replace(/\s+/g, ' ').slice(0, 200);
    if (!q || loading) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    setResult(null);
    setActiveIdx(null);

    try {
      const cached = readResearchCache(localStorage, q, locale);
      if (cached) {
        if (requestId === requestIdRef.current) {
          setResult({ ...cached, query: q });
          if (!embedded) setHistory((prev) => [q, ...prev.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 8));
        }
        return;
      }

      const res = await runResearch(q, t.research.genericError, locale);
      writeResearchCache(localStorage, q, locale, res);
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

  const searchBar = (
    <div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
          placeholder={t.research.searchPlaceholder}
          maxLength={200}
          autoFocus={embedded}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 placeholder-gray-400 transition focus:border-violet-400 focus:shadow-[0_0_18px_rgba(139,92,246,.25)] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:placeholder-white/40"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          className="flex-1 rounded-xl bg-violet-500 px-5 py-2.5 font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,.4)] transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-40 disabled:shadow-none"
        >
          {loading ? '...' : t.research.searchCta}
        </button>
        {embedded && onClose && (
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-3 py-2.5 transition hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/10"
            aria-label={t.research.closeAria}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  // Renders like a search-engine results page: title link, url line,
  // snippet — one card per source, instead of one AI-written essay.
  const resultsBlock = result && (
    result.results.length === 0 ? (
      <p role="status" className="mt-6 text-sm text-gray-500 dark:text-white/50">{t.research.noResults}</p>
    ) : (
    <div className={embedded ? 'mt-4 space-y-3' : 'mx-auto max-w-3xl space-y-3'}>
      {!result.grounded && (
        <p className="text-xs text-gray-400 dark:text-white/40">
          {t.research.notGroundedNote}
        </p>
      )}
      {result.results.map((r, i) => {
        const host = hostOf(r.url);
        const color = NODE_COLORS[Math.max(0, Array.from(new Set(result.results.map((x) => hostOf(x.url)).filter(Boolean))).indexOf(host)) % NODE_COLORS.length];
        return (
        <motion.div
          key={i}
          id={`research-result-${i}`}
          onMouseEnter={() => setActiveIdx(i)}
          onMouseLeave={() => setActiveIdx(null)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className={`rounded-2xl border p-4 transition ${
            activeIdx === i
              ? 'border-violet-400/60 bg-violet-500/[0.08] shadow-[0_0_26px_rgba(139,92,246,.2)]'
              : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.035]'
          }`}
        >
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ backgroundColor: `${color}26`, color }}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              {r.url && isSafeResearchUrl(r.url) ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="group block">
                  <p className="mb-0.5 truncate text-xs text-gray-400 dark:text-white/40">{displayUrl(r.url)}</p>
                  <h3 className="text-base font-medium underline-offset-2 group-hover:underline">{r.title}</h3>
                </a>
              ) : (
                <h3 className="text-base font-medium">{r.title}</h3>
              )}
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-white/70">{r.snippet}</p>
            </div>
          </div>
        </motion.div>
        );
      })}
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
        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
        {resultsBlock}
        {!result && !loading && (
          <p className="text-sm text-gray-400 dark:text-white/40 mt-4">{t.research.embedded.hint}</p>
        )}
      </div>
    );
  }

  const pickResult = (i: number) => {
    setActiveIdx(i);
    document.getElementById(`research-result-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="dark">
      <div className="relative min-h-dvh overflow-hidden bg-[#080d19] p-4 text-slate-100 md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-500/[0.09] blur-[120px]" />
          <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-violet-600/[0.13] blur-[120px]" />
        </div>
        <div className="relative mx-auto w-full max-w-5xl">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-3 md:mb-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200"><Search className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{t.research.header.title}</h1>
              <p className="mt-0.5 text-sm text-slate-400 md:text-base">{t.research.header.subtitle}</p>
            </div>
          </motion.div>

          <div className="mb-6">
            {searchBar}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

            {history.length > 0 && !loading && (
              <div className="mt-3 flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      setQuery(h);
                      void handleSearch(h);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-violet-300/50 hover:bg-violet-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>

          {result && result.results.length > 0 && (
            <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2 md:p-4">
              <ResultMap query={result.query} results={result.results} activeIdx={activeIdx} onActive={setActiveIdx} onPick={pickResult} ariaLabel={t.research.mapAria} />
            </div>
          )}

          {resultsBlock}

          {!result && !loading && (
            <div className="mx-auto max-w-2xl py-16 text-center text-slate-400">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-400/10 text-violet-300 shadow-[0_0_30px_rgba(139,92,246,.25)]"><Search className="h-7 w-7" /></span>
              <p className="mb-2 text-lg">{t.research.emptyState.title}</p>
              <p className="text-sm">{t.research.emptyState.subtitle}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
