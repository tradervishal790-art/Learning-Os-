import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Newspaper, Flame, RotateCw, Check, X, CirclePlay, Bookmark, ExternalLink, ListChecks, Landmark, Globe, TrendingUp, Trophy, FlaskConical, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import { format } from './i18n/format';
import {
  istDateKey,
  loadCurrentAffairsDay,
  loadProgress,
  recordQuizResult,
  computeStreak,
  hydrateCurrentAffairsFromCloud,
} from './currentAffairsStore';
import type { CACategory, CADay, CAPoint, CAProgress, CAQuizQuestion } from './currentAffairsStore';
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
const SWIPE_ROW = 'flex gap-2 overflow-x-auto md:flex-wrap -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

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
    <div className="max-w-3xl mx-auto">
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
                ? 'border-black dark:border-white text-black dark:text-white'
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
  const [progress, setProgress] = useState<CAProgress>(() => loadProgress());
  const [saved, setSaved] = useState<SavedPoint[]>(() => loadSaved());
  const [showSaved, setShowSaved] = useState(false);
  const savedKeys = useMemo(() => new Set(saved.map((x) => savedKey(x.date, x))), [saved]);
  const goToQuiz = () => document.getElementById('ca-quiz')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    void hydrateCurrentAffairsFromCloud().then(() => setProgress(loadProgress()));
  }, []);

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

  const streak = computeStreak(progress);
  const doneToday = !!progress.quizzes[today];

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
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-gray-200 dark:border-white/10" title={format(c.streak, streak)}>
              <Flame className="w-4 h-4" />
              <span className="md:hidden">{streak}</span>
              <span className="hidden md:inline">{format(c.streak, streak)}</span>
            </span>
          )}
          {doneToday && (
            <span className="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-black text-white dark:bg-white dark:text-black" title={c.streakDone} aria-label={c.streakDone}>
              <Check className="w-4 h-4" />
              <span className="hidden md:inline">{c.streakDone}</span>
            </span>
          )}
          <button
            onClick={() => setShowSaved((v) => !v)}
            aria-label="Saved"
            title="Saved"
            aria-pressed={showSaved}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition ${
              showSaved ? 'bg-black text-white dark:bg-white dark:text-black' : 'border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
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
            className={`flex-shrink-0 h-10 px-4 text-sm rounded-full border transition ${
              d === date
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
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
        <div className="mt-6">
          {saved.length === 0 ? (
            <div className="py-16 flex justify-center text-gray-300 dark:text-white/20" aria-label="No saved points yet">
              <Bookmark className="w-12 h-12" strokeWidth={1.25} />
            </div>
          ) : (
            <ul className="space-y-3">
              {saved.map((p) => (
                <PointCard key={savedKey(p.date, p)} point={p} saved onToggleSave={() => setSaved(toggleSaved(p.date, p))} sourceLabel={c.sourceLabel} />
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
                    tab === x ? 'bg-gray-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'
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
                onQuiz={day.quiz.length > 0 ? goToQuiz : undefined}
                sourceLabel={c.sourceLabel}
              />
            ))}
          </ul>

          <p className="mt-4 text-xs text-gray-400 dark:text-white/30">{c.aiNote}</p>

          {day.quiz.length > 0 && (
            <Quiz
              key={`${day.date}_${day.locale}`}
              day={day}
              isToday={date === today}
              onFinished={(score, total, wrong) => {
                if (date === today) setProgress(recordQuizResult(date, score, total, wrong));
              }}
            />
          )}
        </>
      )}

      {!showSaved && progress.mistakes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">{c.mistakesTitle}</h2>
          <ul className="mt-3 space-y-3">
            {progress.mistakes.slice(0, 5).map((m, i) => (
              <li key={`${m.date}-${i}`} className="border border-gray-200 dark:border-white/10 rounded-lg p-4 text-sm">
                <p>{m.question}</p>
                <p className="mt-2">
                  <span className="text-gray-500 dark:text-white/40">{c.correctAnswerLabel}: </span>
                  {m.correctAnswer}
                </p>
                {m.explanation && <p className="mt-1 text-gray-500 dark:text-white/50">{m.explanation}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Quiz({
  day,
  isToday,
  onFinished,
}: {
  day: CADay;
  isToday: boolean;
  onFinished: (score: number, total: number, wrong: { date: string; question: string; correctAnswer: string; explanation: string }[]) => void;
}) {
  const t = useTranslation();
  const c = t.currentAffairs;
  const [picked, setPicked] = useState<Record<number, number>>({});
  const total = day.quiz.length;
  const answered = Object.keys(picked).length;
  const finished = answered === total;
  const score = day.quiz.reduce((n, q: CAQuizQuestion, i) => n + (picked[i] === q.correctIndex ? 1 : 0), 0);

  useEffect(() => {
    if (!finished || !isToday) return;
    const wrong = day.quiz
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => picked[i] !== q.correctIndex)
      .map(({ q }) => ({ date: day.date, question: q.question, correctAnswer: q.options[q.correctIndex], explanation: q.explanation }));
    onFinished(score, total, wrong);
    // Runs once when the last question is answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return (
    <div id="ca-quiz" className="mt-10 scroll-mt-4">
      <h2 className="text-lg font-semibold">{c.quizTitle}</h2>
      <p className="text-sm text-gray-500 dark:text-white/50">{c.quizSubtitle}</p>

      <div className="mt-4 space-y-5">
        {day.quiz.map((q, qi) => {
          const sel = picked[qi];
          const revealed = sel !== undefined;
          return (
            <div key={qi} className="border border-gray-200 dark:border-white/10 rounded-lg p-4">
              <p className="font-medium">
                {qi + 1}. {q.question}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  const isPicked = sel === oi;
                  let style = 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10';
                  if (revealed && isCorrect) style = 'border-green-500 bg-green-500/10';
                  else if (revealed && isPicked) style = 'border-red-500 bg-red-500/10';
                  return (
                    <button
                      key={oi}
                      disabled={revealed}
                      onClick={() => setPicked((prev) => ({ ...prev, [qi]: oi }))}
                      className={`w-full text-left px-3 py-3 min-h-11 text-sm rounded-lg border transition flex items-center gap-2 ${style} ${revealed ? 'cursor-default' : ''}`}
                    >
                      <span className="flex-1">{opt}</span>
                      {revealed && isCorrect && <Check className="w-4 h-4 text-green-500" />}
                      {revealed && isPicked && !isCorrect && <X className="w-4 h-4 text-red-500" />}
                    </button>
                  );
                })}
              </div>
              {revealed && (
                <p className="mt-3 text-sm text-gray-500 dark:text-white/50">
                  <span className="font-medium text-gray-700 dark:text-white/70">{sel === q.correctIndex ? c.correct : c.wrong}</span>{' '}
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {finished && (
        <p className="mt-5 text-lg font-semibold">{format(c.scoreLine, score, total)}</p>
      )}
    </div>
  );
}

const CATEGORY_ICON = TAB_ICONS;

/** One news point: category icon, text, source, and icon-only actions (read / save / quiz). */
function PointCard({
  point,
  saved,
  onToggleSave,
  onQuiz,
  sourceLabel,
}: {
  point: CAPoint;
  saved: boolean;
  onToggleSave: () => void;
  onQuiz?: () => void;
  sourceLabel: string;
}) {
  const Icon = CATEGORY_ICON[point.category];
  const hasLink = !!point.link && /^https?:\/\//i.test(point.link);
  const action = 'w-11 h-11 rounded-full flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 active:bg-gray-200 dark:active:bg-white/15 transition-colors';
  return (
    <li className="border border-gray-200 dark:border-white/10 rounded-2xl p-4">
      <div className="flex gap-3">
        <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </span>
        <p className="leading-relaxed min-w-0">{point.text}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-white/50 truncate min-w-0" title={`${sourceLabel}: ${point.source}`}>
          {point.source}
        </p>
        <div className="flex items-center flex-shrink-0 -mr-2">
          {hasLink && (
            <a href={point.link} target="_blank" rel="noopener noreferrer" aria-label="Read" title="Read" className={action}>
              <ExternalLink className="w-5 h-5" strokeWidth={1.75} />
            </a>
          )}
          <button
            onClick={onToggleSave}
            aria-label={saved ? 'Remove from saved' : 'Save'}
            title={saved ? 'Remove from saved' : 'Save'}
            aria-pressed={saved}
            className={`${action} ${saved ? 'text-black dark:text-white' : ''}`}
          >
            <Bookmark className="w-5 h-5" strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
          </button>
          {onQuiz && (
            <button onClick={onQuiz} aria-label="Quiz" title="Quiz" className={action}>
              <ListChecks className="w-5 h-5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
