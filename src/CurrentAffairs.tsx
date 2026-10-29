import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Newspaper, X, RotateCw, CirclePlay, Bookmark, ExternalLink, Landmark, Globe, TrendingUp, Trophy, FlaskConical, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import {
  istDateKey,
  loadCurrentAffairsDay,
} from './currentAffairsStore';
import type { CACategory, CADay, CAPoint } from './currentAffairsStore';
import { loadSaved, toggleSaved, savedKey } from './caSavedStore';
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

  return (
    <div className="ca-theme max-w-3xl mx-auto px-4 py-5 md:px-8 md:py-8">
      <div className="flex border-b border-gray-200 dark:border-white/10">
        {([['news', Newspaper, c.switchNews], ['channels', CirclePlay, c.switchChannels]] as const).map(([v, Icon, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-label={label}
            title={label}
            aria-pressed={view === v}
            className={`flex-1 h-12 flex items-center justify-center border-b-2 transition ${
              view === v
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white'
            }`}
          >
            <Icon className="w-6 h-6" strokeWidth={view === v ? 2.2 : 1.75} />
          </button>
        ))}
      </div>

      {view === 'news' ? (
        <NewspaperCurrentAffairs />
      ) : (
        <Suspense fallback={null}>
          <ChannelDigest />
        </Suspense>
      )}
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
  const savedKeys = useMemo(() => new Set(saved.map((x) => savedKey(x.date, x))), [saved]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setDay(null);
    try {
      const result = await loadCurrentAffairsDay(date, locale, date === today);
      if (!result) setError(c.dayNotAvailable);
      setDay(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [date, locale, today, c.dayNotAvailable]);

  useEffect(() => {
    setTab('all');
    void load();
  }, [load]);

  const visiblePoints = useMemo(() => (day ? day.points.filter((p) => tab === 'all' || p.category === tab) : []), [day, tab]);
  const presentTabs = useMemo(() => {
    const set = new Set(day?.points.map((p) => p.category) ?? []);
    return TAB_ORDER.filter((x) => x === 'all' || set.has(x));
  }, [day]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
            <Newspaper className="hidden md:block w-6 h-6" />
            {c.title}
          </h1>
          <p className="hidden md:block text-sm text-gray-500 dark:text-white/50 mt-1">{c.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          <button
            onClick={() => setShowSaved((v) => !v)}
            aria-label="Saved"
            title="Saved"
            aria-pressed={showSaved}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition ${
              showSaved ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white' : 'card hover:bg-gray-50 dark:hover:bg-white/10'
            }`}
          >
            <Bookmark className="w-5 h-5" strokeWidth={1.75} fill={showSaved || saved.length > 0 ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Day picker: today + last few days (only days someone already opened are available) */}
      {!showSaved && (
      <div className={`mt-4 ${SWIPE_ROW}`}>
        {Array.from({ length: PREVIOUS_DAYS + 1 }, (_, i) => istDateKey(i)).map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            aria-pressed={d === date}
            className={`flex-shrink-0 h-10 px-4 text-sm rounded-full border transition ${
              d === date
                ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:text-white dark:border-indigo-500'
                : 'card border-transparent hover:bg-gray-50 dark:hover:bg-white/10'
            }`}
          >
            {d === today ? c.today : formatDateLabel(d, locale)}
          </button>
        ))}
      </div>
      )}

      {!showSaved && loading && <p className="mt-8 text-gray-500 dark:text-white/50 animate-pulse">{c.loading}</p>}

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
        <div className="mt-6 rounded-2xl bg-white/80 p-3 md:p-4">
          {saved.length === 0 ? (
            <div className="py-16 flex justify-center text-gray-300 dark:text-white/20" aria-label="No saved points yet">
              <Bookmark className="w-12 h-12" strokeWidth={1.25} />
            </div>
          ) : (
            <ul className="space-y-3">
              {saved.map((p) => (
                <PointCard key={savedKey(p.date, p)} point={p} saved onToggleSave={() => setSaved(toggleSaved(p.date, p))} onRead={setSelectedArticle} sourceLabel={c.sourceLabel} />
              ))}
            </ul>
          )}
        </div>
      )}

      {!showSaved && !loading && day && (
        <>
          <div className={`mt-5 ${SWIPE_ROW}`}>
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
                    tab === x ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'card text-gray-600 dark:text-white/60'
                  }`}
                >
                  <TabIcon className="w-4 h-4" strokeWidth={1.75} />
                  <span className="hidden md:inline">{c.tabs[x]}</span>
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Learning OS · News reader</p>
                <h2 id="ca-reader-title" className="mt-1 text-lg font-bold leading-snug">{selectedArticle.source}</h2>
              </div>
              <button type="button" onClick={() => setSelectedArticle(null)} aria-label="Close reader" className="ca-reader-close"><X className="w-5 h-5" /></button>
            </header>
            <div className="ca-reader-summary">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Quick read · News summary</p>
              <p className="mt-2 text-base leading-relaxed text-slate-800">{selectedArticle.text}</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">This is the news brief available in Learning OS, not the publisher's full article. Some publishers block their pages from being displayed inside other apps.</p>
            </div>
            <footer className="ca-reader-footer">
              {selectedArticle.link && /^https?:\/\//i.test(selectedArticle.link) ? (
                <a href={selectedArticle.link} target="_blank" rel="noopener noreferrer" className="ca-reader-open"><ExternalLink className="w-4 h-4" /> Read full article on {selectedArticle.source}</a>
              ) : (
                <p className="text-sm text-slate-500">The original article link is not available for this news item.</p>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

const CATEGORY_ICON = TAB_ICONS;

/** One news point with compact mobile actions (in-app read and save). */
function PointCard({
  point,
  saved,
  onToggleSave,
  onRead,
  sourceLabel,
}: {
  point: CAPoint;
  saved: boolean;
  onToggleSave: () => void;
  onRead: (point: CAPoint) => void;
  sourceLabel: string;
}) {
  const Icon = CATEGORY_ICON[point.category];
  const hasLink = !!point.link && /^https?:\/\//i.test(point.link);
  const action = 'min-h-9 px-2.5 gap-1.5 rounded-full inline-flex items-center justify-center text-xs font-medium text-slate-600 hover:bg-sky-50 active:bg-sky-100 transition-colors';
  return (
    <li className="card rounded-2xl p-4">
      <div className="flex gap-3">
        <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </span>
        <p className="text-[15px] md:text-base leading-relaxed min-w-0">{point.text}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-white/50 truncate min-w-0" title={`${sourceLabel}: ${point.source}`}>
          {point.source}
        </p>
        <div className="flex items-center flex-shrink-0 -mr-2">
          {hasLink && (
            <button type="button" onClick={() => onRead(point)} aria-label="Read in Learning OS" title="Read in Learning OS" className={action}>
              <Newspaper className="w-4 h-4" strokeWidth={1.75} />
              <span>Read</span>
            </button>
          )}
          <button
            onClick={onToggleSave}
            aria-label={saved ? 'Remove from saved' : 'Save'}
            title={saved ? 'Remove from saved' : 'Save'}
            aria-pressed={saved}
            className={`${action} ${saved ? 'text-black dark:text-white' : ''}`}
          >
            <Bookmark className="w-4 h-4" strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </li>
  );
}
