import { useCallback, useEffect, useMemo, useState } from 'react';
import { Newspaper, Flame, RotateCw, Check, X } from 'lucide-react';
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
import type { CACategory, CADay, CAProgress, CAQuizQuestion } from './currentAffairsStore';

type Tab = 'all' | CACategory;
const TAB_ORDER: Tab[] = ['all', 'national', 'international', 'economy', 'sports', 'scitech'];
const PREVIOUS_DAYS = 6;

function formatDateLabel(date: string, locale: string): string {
  try {
    const intl = locale === 'en' ? 'en-IN' : 'hi-IN';
    return new Date(`${date}T00:00:00Z`).toLocaleDateString(intl, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return date;
  }
}

export default function CurrentAffairs() {
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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Newspaper className="w-6 h-6" />
            {c.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1">{c.subtitle}</p>
        </div>
        {(streak > 0 || doneToday) && (
          <div className="flex items-center gap-2 text-sm">
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10">
                <Flame className="w-4 h-4" />
                {format(c.streak, streak)}
              </span>
            )}
            {doneToday && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-black text-white dark:bg-white dark:text-black">
                <Check className="w-4 h-4" />
                {c.streakDone}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Day picker: today + last few days (only days someone already opened are available) */}
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: PREVIOUS_DAYS + 1 }, (_, i) => istDateKey(i)).map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={`px-3 py-1.5 text-sm rounded-full border transition ${
              d === date
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            {d === today ? c.today : formatDateLabel(d, locale)}
          </button>
        ))}
      </div>

      {loading && <p className="mt-8 text-gray-500 dark:text-white/50 animate-pulse">{c.loading}</p>}

      {!loading && error && (
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

      {!loading && day && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {presentTabs.map((x) => (
              <button
                key={x}
                onClick={() => setTab(x)}
                className={`px-3 py-1 text-xs rounded-full transition ${
                  tab === x ? 'bg-gray-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'
                }`}
              >
                {c.tabs[x]}
              </button>
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {visiblePoints.map((p, i) => (
              <li key={`${tab}-${i}`} className="border border-gray-200 dark:border-white/10 rounded-lg p-4">
                <p className="leading-relaxed">{p.text}</p>
                <p className="mt-2 text-xs text-gray-500 dark:text-white/50">
                  {c.sourceLabel}:{' '}
                  {p.link && /^https?:\/\//i.test(p.link) ? (
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-black dark:hover:text-white">
                      {p.source}
                    </a>
                  ) : (
                    p.source
                  )}
                </p>
              </li>
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

      {progress.mistakes.length > 0 && (
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
    <div className="mt-10">
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
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition flex items-center gap-2 ${style} ${revealed ? 'cursor-default' : ''}`}
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
