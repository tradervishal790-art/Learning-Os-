import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Search, Volume2, RotateCw, Sparkles, Shuffle, ArrowRight, BookOpen, History, AlertTriangle, Loader2 } from 'lucide-react';
import { ensureDictionaryLoaded, getDictionaryDiscoveryWords, lookupWord, suggestWords } from './dictionaryStore';
import type { DictionaryEntry } from './dictionaryStore';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { GlassButton, GlassPanel } from './ui/kit';

const RECENT_KEY = 'learning_os_dictionary_recent';
const RECENT_LIMIT = 10;

const ACCENT = '#a78bfa'; // violet — this screen's main colour
const DANGER = '#f87171';

/** Part-of-speech colour. The dictionary data uses words like "noun" / "adjective"; anything
 *  else (idiom, prefix, …) falls back to the screen accent. */
function posAccent(pos: string): string {
  const key = pos.toLowerCase().replace(/[^a-z]/g, '');
  if (key.startsWith('noun')) return '#67e8f9';
  if (key.startsWith('verb')) return '#6ee7b7';
  if (key.startsWith('adj')) return '#fbbf24';
  if (key.startsWith('adv')) return '#e879f9';
  return ACCENT;
}

function PosBadge({ pos }: { pos: string }) {
  const color = posAccent(pos);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
      style={{ color, backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {pos}
    </span>
  );
}

/** Placeholder block for loading states. */
function Shimmer({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-white/[0.08] motion-reduce:animate-none ${className}`} />;
}

function localDateSeed(): string {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export default function Dictionary() {
  const t = useTranslation();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [discoveryWords, setDiscoveryWords] = useState<string[]>([]);
  const [discoveryRound, setDiscoveryRound] = useState(0);
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
    if (loading || loadError) return;
    let cancelled = false;
    void getDictionaryDiscoveryWords(localDateSeed() + ':' + discoveryRound, 5)
      .then((words) => { if (!cancelled) setDiscoveryWords(words); })
      .catch(() => { if (!cancelled) setDiscoveryWords([]); });
    return () => { cancelled = true; };
  }, [loading, loadError, discoveryRound]);
  useEffect(() => {
    const q = query.trim();
    if (!q || entry || searching) {
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
  }, [query, entry, searching]);

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
      if (requestId === searchIdRef.current) setSearchError(t.dictionary.searchError);
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
  const uniquePos = entry ? Array.from(new Set(entry.partsOfSpeech)) : [];
  const typedLength = query.trim().length;
  const searchDisabled = loading || loadError;
  const showHome = !loading && !entry && !notFound && !loadError && !searching;

  return (
    <div className="dark">
      <div className="relative min-h-dvh overflow-hidden bg-[#080d19] p-4 text-slate-100 md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-violet-600/[0.14] blur-[120px]" />
          <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
          <div className="absolute -bottom-40 left-1/4 h-[340px] w-[340px] rounded-full bg-fuchsia-600/[0.07] blur-[120px]" />
        </div>

        <div className="relative mx-auto w-full min-w-0 max-w-5xl break-words [overflow-wrap:anywhere]">
          <motion.header
            initial={reduce ? false : { opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-3 md:mb-8"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{t.dashboard.sidebar.dictionary}</h1>
              <p className="mt-0.5 text-sm text-slate-400 md:text-base">{t.dictionary.subtitle}</p>
            </div>
          </motion.header>

          {/* Search */}
          <div className="relative mx-auto mb-6 max-w-3xl">
            <div
              aria-busy={loading}
              className={`flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.045] pl-4 pr-2 transition-[border-color,box-shadow,opacity] duration-200 focus-within:border-violet-400/70 focus-within:shadow-[0_0_0_4px_rgba(167,139,250,0.14),0_0_44px_rgba(167,139,250,0.28)] motion-reduce:transition-none ${searchDisabled ? 'opacity-60' : ''}`}
            >
              <Search className="h-5 w-5 shrink-0 text-violet-300" aria-hidden="true" />
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
                placeholder={loading ? t.dictionary.loading : t.dictionary.searchPlaceholder}
                aria-label={t.dictionary.searchAria}
                maxLength={80}
                disabled={searchDisabled}
                autoFocus
                className="min-h-14 min-w-0 flex-1 bg-transparent text-lg text-slate-100 placeholder-slate-500 focus:outline-none disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => void search(query)}
                disabled={searchDisabled || searching || !query.trim()}
                aria-label={t.dictionary.searchAria}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/20 text-violet-100 transition hover:bg-violet-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-violet-400/20 motion-reduce:transition-none"
              >
                {searching ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>

            {suggestions.length > 0 && (
              <ul
                aria-label={t.dictionary.suggestionsAria}
                className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1424] shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
              >
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => void search(s)}
                      className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-slate-400 transition hover:bg-violet-400/10 hover:text-white focus-visible:bg-violet-400/15 focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300 motion-reduce:transition-none"
                    >
                      <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-white">{s.slice(0, typedLength)}</span>
                        {s.slice(typedLength)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dictionary file loading: shimmering placeholders */}
          {loading && (
            <div aria-busy="true">
              <p role="status" className="mb-4 flex items-center gap-2 text-sm text-slate-400">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                </span>
                {t.dictionary.loading}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                    <Shimmer className="h-4 w-2/3" />
                    <Shimmer className="mt-3 h-3 w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <GlassPanel accent={DANGER} className="mx-auto max-w-3xl">
              <div role="alert" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-400/15 text-red-300">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="min-w-0 flex-1 text-sm text-red-200 md:text-base">{t.dictionary.loadError}</p>
                <button
                  type="button"
                  onClick={loadDictionary}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-red-300/30 bg-red-400/10 px-4 text-sm text-red-100 transition hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 motion-reduce:transition-none"
                >
                  <RotateCw className="h-4 w-4" aria-hidden="true" /> {t.dictionary.retry}
                </button>
              </div>
            </GlassPanel>
          )}

          {/* Home: discovery + recent words */}
          {showHome && discoveryWords.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold md:text-xl">{t.dictionary.discoveryTitle}</h2>
                    <p className="mt-0.5 text-sm text-slate-400">{t.dictionary.discoverySubtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDiscoveryRound((round) => round + 1)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm text-slate-200 transition hover:border-violet-300/50 hover:bg-violet-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none"
                >
                  <Shuffle className="h-4 w-4" aria-hidden="true" /> {t.dictionary.surpriseMe}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {discoveryWords.map((word) => (
                  <GlassButton key={word} onClick={() => void search(word)} accent={ACCENT} className="min-h-[76px] min-w-0">
                    <span className="flex h-full min-w-0 flex-col justify-between gap-2 p-4">
                      <span className="block truncate text-base font-medium">{word}</span>
                      <span className="flex items-center gap-1 text-xs text-violet-300">
                        <span>{t.dictionary.explore}</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </span>
                  </GlassButton>
                ))}
              </div>
            </section>
          )}

          {showHome && recent.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-300">
                  <History className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold md:text-xl">{t.dictionary.recent}</h2>
                <span className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-xs font-medium text-violet-200">{recent.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {recent.map((r) => (
                  <GlassButton key={r} onClick={() => void search(r)} accent={ACCENT} className="min-h-12 min-w-0">
                    <span className="flex min-w-0 items-center justify-between gap-2 px-4 py-3">
                      <span className="truncate text-sm font-medium">{r}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    </span>
                  </GlassButton>
                ))}
              </div>
            </section>
          )}

          {/* Lookup in progress */}
          {searching && (
            <div aria-busy="true">
              <p role="status" className="mb-4 flex items-center gap-2 text-sm text-slate-400">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                </span>
                {t.dictionary.searching}
              </p>
              <GlassPanel accent={ACCENT}>
                <div className="space-y-4 p-5 md:p-6">
                  <Shimmer className="h-9 w-1/2" />
                  <Shimmer className="h-4 w-1/4" />
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-4 w-5/6" />
                </div>
              </GlassPanel>
            </div>
          )}

          {searchError && (
            <GlassPanel accent={DANGER} className="mx-auto max-w-3xl">
              <p role="alert" className="flex items-center gap-3 p-4 text-sm text-red-200">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
                {searchError}
              </p>
            </GlassPanel>
          )}

          {notFound && (
            <GlassPanel accent={ACCENT} className="mx-auto max-w-3xl">
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-400/10 text-violet-300 shadow-[0_0_30px_rgba(139,92,246,.25)]">
                  <Search className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="text-base text-slate-300">{format(t.dictionary.noEntry, query)}</p>
              </div>
            </GlassPanel>
          )}

          {/* Result */}
          {entry && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
              className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
            >
              <div className="min-w-0 space-y-4">
                <GlassPanel accent={ACCENT}>
                  <div className="p-5 md:p-6">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <h2 className="min-w-0 text-3xl font-semibold tracking-tight md:text-5xl">{entry.word}</h2>
                      {entry.ipa && <span className="text-lg text-slate-400">/{entry.ipa}/</span>}
                      {entry.audioUrl && (
                        <>
                          <button
                            type="button"
                            onClick={playAudio}
                            aria-label={t.dictionary.pronunciation}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-violet-200 transition hover:border-violet-300/50 hover:bg-violet-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none"
                          >
                            <Volume2 className="h-5 w-5" aria-hidden="true" />
                          </button>
                          <audio ref={audioRef} src={entry.audioUrl} preload="none" />
                        </>
                      )}
                      {entry.level && (
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-slate-300">{entry.level}</span>
                      )}
                    </div>
                    {uniquePos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {uniquePos.map((pos) => <PosBadge key={pos} pos={pos} />)}
                      </div>
                    )}

                    <dl className="mt-5 grid gap-5 border-t border-white/[0.08] pt-5 sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">{t.dictionary.hindi}</dt>
                        <dd className="mt-1 text-xl md:text-2xl">{hindiSummary.join(', ') || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">{t.dictionary.sanskrit}</dt>
                        <dd className="mt-1 text-xl md:text-2xl">{entry.sanskritMatches?.map((m) => m.devanagari).join(', ') || '—'}</dd>
                      </div>
                    </dl>
                  </div>
                </GlassPanel>

                <GlassPanel accent={ACCENT}>
                  <div className="p-5 md:p-6">
                    <div className="mb-1 flex items-center gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t.dictionary.meanings}</h3>
                      <span className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-xs font-medium text-violet-200">{entry.senses.length}</span>
                    </div>
                    <ol className="divide-y divide-white/[0.08]">
                      {entry.senses.map((sense, i) => (
                        <li key={i} className="py-4 first:pt-3 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-xs text-slate-300">{i + 1}</span>
                            <PosBadge pos={sense.pos} />
                          </div>
                          {sense.definition && <p className="mt-2 text-base leading-relaxed text-slate-100 md:text-lg">{sense.definition}</p>}
                          {sense.example && (
                            <blockquote className="mt-3 max-w-prose rounded-2xl rounded-tl-sm bg-white/[0.06] px-4 py-3 text-sm italic leading-relaxed text-slate-300">
                              “{sense.example}”
                            </blockquote>
                          )}
                          {sense.hindi.length > 0 && (
                            <p className="mt-3 text-base">
                              <span className="text-sm text-slate-500">{t.dictionary.hindi}: </span>
                              {sense.hindi.join(', ')}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                </GlassPanel>
              </div>

              <div className="min-w-0 space-y-4">
                <GlassPanel accent={ACCENT}>
                  <div className="p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{t.dictionary.sanskrit}</h3>
                    {entry.sanskritMatches && entry.sanskritMatches.length > 0 ? (
                      <>
                        <ul className="space-y-2">
                          {entry.sanskritMatches.map((m, i) => (
                            <li key={i}>
                              <span className="text-2xl">{m.devanagari}</span>
                              <span className="text-sm text-slate-400"> ({m.slp1})</span>
                              {m.meaning && <span className="text-xs text-slate-500"> · {m.meaning}</span>}
                            </li>
                          ))}
                        </ul>
                        <p className={`mt-3 text-xs leading-relaxed ${entry.sanskritMatches[0].src === 'a' ? 'text-slate-500' : 'text-amber-300/80'}`}>
                          {entry.sanskritMatches[0].src === 'a'
                            ? t.dictionary.sanskritSourceApte
                            : entry.sanskritMatches[0].src === 'm'
                              ? t.dictionary.sanskritSourceMonier
                              : t.dictionary.sanskritSourceApprox}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm leading-relaxed text-slate-400">{t.dictionary.noSanskrit}</p>
                    )}
                  </div>
                </GlassPanel>

                {entry.forms && entry.forms.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{t.dictionary.forms}</p>
                    <div className="flex flex-wrap gap-2">
                      {entry.forms.map((form) => (
                        <span key={form} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300">{form}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
