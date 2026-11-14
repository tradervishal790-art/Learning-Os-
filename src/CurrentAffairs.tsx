import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Newspaper, X, RotateCw, CirclePlay, Bookmark, ExternalLink, Landmark, Globe, TrendingUp, Trophy, FlaskConical, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import {
  istDateKey,
  loadCurrentAffairsDay,
} from './currentAffairsStore';
import type { CACategory, CADay, CAPoint } from './currentAffairsStore';
import { GlassPanel } from './ui/kit';
import { loadSaved, toggleSaved, savedKey } from './caSavedStore';
import { safeArticleUrl } from './newsReader';
import type { SavedPoint } from './caSavedStore';

const ChannelDigest = lazy(() => import('./ChannelDigest'));

type Tab = 'all' | CACategory;
const TAB_ORDER: Tab[] = ['all', 'national', 'international', 'economy', 'sports', 'scitech'];
const PREVIOUS_DAYS = 6;

const TAB_ICONS: Record<Tab, LucideIcon> = {
  all: LayoutGrid,
  national: Landmark,
  international: Globe,
  economy: TrendingUp,
  sports: Trophy,
  scitech: FlaskConical,
};

/** Hides the scrollbar on horizontal icon/chip rows (Instagram-style swipe rows). */
const SWIPE_ROW = 'flex gap-2 overflow-x-auto md:flex-wrap -mx-4 px-4 py-1 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function formatDateLabel(date: string, locale: string): string {
  try {
    const intl = locale === 'en' ? 'en-IN' : 'hi-IN';
    return new Date(`${date}T00:00:00Z`).toLocaleDateString(intl, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return date;
  }
}

/** Current Affairs page: the newspaper digest (default) or the digest of the student's YouTube channels. */
export default function CurrentAffairs() {
  const t = useTranslation();
  const [view, setView] = useState<'news' | 'channels'>('news');
  const c = t.channelDigest;
  const c2 = t.currentAffairs;

  return (
    <div className="dark">
    <div className="ca-theme relative mx-auto max-w-3xl overflow-hidden px-4 py-5 md:px-8 md:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hidden md:block absolute -left-32 -top-40 h-[380px] w-[380px] rounded-full bg-violet-600/[0.13] blur-[120px]" />
        <div className="hidden md:block absolute -right-24 top-1/2 h-[340px] w-[340px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
      </div>
      <div className="relative">
      <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {([['news', Newspaper, c.switchNews], ['channels', CirclePlay, c.switchChannels]] as const).map(([v, Icon, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-label={label}
            title={label}
            aria-pressed={view === v}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              view === v
                ? 'bg-violet-500 text-white shadow-[0_0_18px_rgba(139,92,246,.45)]'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={view === v ? 2.2 : 1.75} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {view === 'news' ? (
        <NewspaperCurrentAffairs />
      ) : (
        <Suspense fallback={<p role="status" className="mt-6 text-sm text-gray-500 dark:text-white/50">{c2.openingDigest}</p>}>
          <ChannelDigest />
        </Suspense>
      )}
      </div>
    </div>
    </div>
  );
}

function NewspaperCurrentAffairs() {
  const t = useTranslation();
  const { locale } = useLanguage();
  const c = t.currentAffairs;

  const today = istDateKey(0);
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<CADay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [saved, setSaved] = useState<SavedPoint[]>(() => loadSaved());
  const [showSaved, setShowSaved] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<CAPoint | null>(null);
  const loadIdRef = useRef(0);
  const savedKeys = useMemo(() => new Set(saved.map((x) => savedKey(x.date, x))), [saved]);
  const articleUrl = safeArticleUrl(selectedArticle?.link);

  const load = useCallback(async () => {
    const requestId = ++loadIdRef.current;
    setLoading(true);
    setError('');
    setDay(null);
    try {
      const result = await loadCurrentAffairsDay(date, locale, date === today);
      if (requestId !== loadIdRef.current) return;
      if (!result) setError(c.dayNotAvailable);
      setDay(result);
    } catch (err) {
      if (requestId === loadIdRef.current) setError(err instanceof Error ? err.message : c.genericError);
    } finally {
      if (requestId === loadIdRef.current) setLoading(false);
    }
  }, [date, locale, today, c.dayNotAvailable, c.genericError]);

  useEffect(() => {
    setTab('all');
    void load();
    return () => { loadIdRef.current += 1; };
  }, [load]);

  const visiblePoints = useMemo(() => (day ? day.points.filter((p) => tab === 'all' || p.category === tab) : []), [day, tab]);
  const presentTabs = useMemo(() => {
    const set = new Set(day?.points.map((p) => p.category) ?? []);
    return TAB_ORDER.filter((x) => x === 'all' || set.has(x));
  }, [day]);

  return (
    <div className="mt-4 md:mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-xl font-semibold tracking-tight md:text-2xl">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200 md:flex"><Newspaper className="h-5 w-5" /></span>
            {c.title}
          </h1>
          <p className="mt-1 hidden text-sm text-slate-400 md:block">{c.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          <button
            onClick={() => setShowSaved((v) => !v)}
            aria-label={c.savedLabel}
            title={c.savedLabel}
            aria-pressed={showSaved}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition ${
              showSaved ? 'bg-violet-500 text-white shadow-[0_0_16px_rgba(139,92,246,.45)]' : 'card hover:bg-white/10'
            }`}
          >
            <Bookmark className="w-5 h-5" strokeWidth={1.75} fill={showSaved || saved.length > 0 ? 'currentColor' : 'none'} />
            {saved.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-semibold tabular-nums text-slate-900">{saved.length}</span>}
          </button>
        </div>
      </div>

      {/* Day picker: today + last few days (only days someone already opened are available) */}
      {!showSaved && (
      <div className={`mt-3 md:mt-4 ${SWIPE_ROW}`}>
        {Array.from({ length: PREVIOUS_DAYS + 1 }, (_, i) => istDateKey(i)).map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={`flex-shrink-0 h-10 px-4 text-sm rounded-full border transition ${
              d === date
                ? 'border-transparent bg-violet-500 text-white shadow-[0_0_16px_rgba(139,92,246,.45)]'
                : 'card border-transparent hover:bg-white/10'
            }`}
          >
            {d === today ? c.today : formatDateLabel(d, locale)}
          </button>
        ))}
      </div>
      )}

      {!showSaved && loading && (
        <div role="status" aria-live="polite" className="mt-8 space-y-3">
          <p className="animate-pulse text-sm text-slate-400 motion-reduce:animate-none">{c.loading}</p>
          {[0, 1, 2].map((n) => <div key={n} aria-hidden="true" className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04] motion-reduce:animate-none" style={{ animationDelay: `${n * 120}ms` }} />)}
        </div>
      )}

      {!showSaved && !loading && error && (
        <div className="mt-8">
          <p className="text-gray-500 dark:text-white/60">{error}</p>
          {date === today && (
            <button
              onClick={() => void load()}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
            >
              <RotateCw className="w-4 h-4" />
              {c.retry}
            </button>
          )}
        </div>
      )}

      {showSaved && (
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 md:p-4">
          {saved.length === 0 ? (
            <div className="py-16 flex justify-center text-gray-300 dark:text-white/20" aria-label={c.noSaved}>
              <Bookmark className="w-12 h-12" strokeWidth={1.25} />
            </div>
          ) : (
            <ul className="space-y-3">
              {saved.map((p) => (
                <PointCard key={savedKey(p.date, p)} point={p} saved onToggleSave={() => setSaved(toggleSaved(p.date, p))} onRead={setSelectedArticle} sourceLabel={c.sourceLabel} labels={{ read: c.read, readInApp: c.readInApp, save: c.save, saved: c.savedLabel, removeSaved: c.removeSaved, category: c.tabs[p.category] }} />
              ))}
            </ul>
          )}
        </div>
      )}

      {!showSaved && !loading && day && (
        <>
          <div className={`mt-3 md:mt-5 ${SWIPE_ROW}`}>
            {presentTabs.map((x) => {
              const TabIcon = TAB_ICONS[x];
              return (
                <button
                  key={x}
                  onClick={() => setTab(x)}
                  aria-label={c.tabs[x]}
                  title={c.tabs[x]}
                  aria-pressed={tab === x}
                  className={`flex-shrink-0 h-10 min-w-10 px-3 inline-flex items-center justify-center gap-1.5 text-xs rounded-full transition ${
                    tab === x ? 'bg-violet-500 text-white shadow-[0_0_16px_rgba(139,92,246,.45)]' : 'card text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <TabIcon className="w-4 h-4" strokeWidth={1.75} />
                  <span className="whitespace-nowrap">{c.tabs[x]}</span>
                </button>
              );
            })}
          </div>

          <ul className="mt-4 space-y-3">
            {visiblePoints.map((p, i) => (
              <PointCard
                key={`${tab}-${i}`}
                point={p}
                saved={savedKeys.has(savedKey(date, p))}
                onToggleSave={() => setSaved(toggleSaved(date, p))}
                onRead={setSelectedArticle}
                sourceLabel={c.sourceLabel}
                labels={{ read: c.read, readInApp: c.readInApp, save: c.save, saved: c.savedLabel, removeSaved: c.removeSaved, category: c.tabs[p.category] }}
              />
            ))}
          </ul>

          <p className="mt-4 text-xs text-gray-400 dark:text-white/30">{c.aiNote}</p>

        </>
      )}

      {selectedArticle && (
        <div className="ca-reader-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedArticle(null); }}>
          <section className="ca-reader-panel" role="dialog" aria-modal="true" aria-labelledby="ca-reader-title">
            <header className="ca-reader-header">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{c.reader.kicker}</p>
                <h2 id="ca-reader-title" className="mt-1 text-lg font-bold leading-snug">{selectedArticle.source}</h2>
              </div>
              <button type="button" onClick={() => setSelectedArticle(null)} aria-label={c.reader.close} className="ca-reader-close"><X className="w-5 h-5" /></button>
            </header>
            {articleUrl ? (
              <div className="ca-reader-frame-wrap">
                <iframe
                  className="ca-reader-frame"
                  src={articleUrl}
                  title={`${c.reader.articleView}: ${selectedArticle.source}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            ) : null}
            <div className="ca-reader-summary">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{c.reader.articleView} · {selectedArticle.source}</p>
              <p className="mt-2 text-base leading-relaxed text-slate-800">{selectedArticle.text}</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{c.reader.fallback}</p>
            </div>
            <footer className="ca-reader-footer">
              {articleUrl ? (
                <a href={articleUrl} target="_blank" rel="noopener noreferrer" className="ca-reader-open"><ExternalLink className="w-4 h-4" /> {c.reader.openOriginal}</a>
              ) : (
                <p className="text-sm text-slate-500">{c.reader.unavailable}</p>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

const CATEGORY_ICON = TAB_ICONS;
const CATEGORY_COLOR: Record<CACategory, string> = { national: '#a78bfa', international: '#67e8f9', economy: '#6ee7b7', sports: '#fbbf24', scitech: '#e879f9' };

/** One news point with compact mobile actions (in-app read and save). */
function PointCard({
  point,
  saved,
  onToggleSave,
  onRead,
  sourceLabel,
  labels,
}: {
  point: CAPoint;
  saved: boolean;
  onToggleSave: () => void;
  onRead: (point: CAPoint) => void;
  sourceLabel: string;
  labels: { read: string; readInApp: string; save: string; saved: string; removeSaved: string; category: string };
}) {
  const Icon = CATEGORY_ICON[point.category];
  const color = CATEGORY_COLOR[point.category];
  const hasLink = !!point.link && /^https?:\/\//i.test(point.link);
  const action = 'min-h-9 px-2.5 gap-1.5 rounded-full inline-flex items-center justify-center text-xs font-medium text-slate-300 hover:bg-white/10 active:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300';
  return (
    <li>
      <GlassPanel accent={color}>
        <div className="p-4">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}22`, color }} aria-hidden="true">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <span className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ backgroundColor: `${color}1f`, color }}>{labels.category}</span>
              <p className="min-w-0 text-[15px] leading-relaxed text-slate-100 md:text-base">{point.text}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-slate-500" title={`${sourceLabel}: ${point.source}`}>
              {point.source}
            </p>
            <div className="-mr-2 flex flex-shrink-0 items-center">
              {hasLink && (
                <button type="button" onClick={() => onRead(point)} aria-label={labels.readInApp} title={labels.readInApp} className={action}>
                  <Newspaper className="h-4 w-4" strokeWidth={1.75} />
                  <span>{labels.read}</span>
                </button>
              )}
              <button
                onClick={onToggleSave}
                aria-label={saved ? labels.removeSaved : labels.save}
                title={saved ? labels.removeSaved : labels.save}
                aria-pressed={saved}
                className={`${action} ${saved ? 'text-amber-300' : ''}`}
              >
                <Bookmark className="h-4 w-4" strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
                <span>{saved ? labels.saved : labels.save}</span>
              </button>
            </div>
          </div>
        </div>
      </GlassPanel>
    </li>
  );
}
