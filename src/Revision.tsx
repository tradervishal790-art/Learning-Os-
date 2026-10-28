import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Route, FileText, Flame, TriangleAlert, CalendarDays, Star, Target, PenLine, Check, Play, Sprout, PartyPopper } from 'lucide-react';
import type { ReactNode } from 'react';
import NotesToRevise from './NotesToRevise';
import { getRevisionDataForGoals } from './revisionData';
import { markDayReviewed, hydrateRevisionFromCloud } from './revisionstore';
import { hydrateRecallScoresFromCloud, saveRecallRating, type RecallRating } from './revisionRecallStore';
import { markTopicFinished } from './roadmapData';
import type { RevisionStatus, RevisionDifficulty, RevisionItem, Goal } from './types';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import StudyPlan from './StudyPlan';
import { studyPlanText } from './studyPlanText';
import { useLanguage } from './i18n/LanguageContext';

const statusIcons: Record<RevisionStatus, ReactNode> = {
  'due-today': <Flame className="w-3 h-3" strokeWidth={2} />,
  overdue: <TriangleAlert className="w-3 h-3" strokeWidth={2} />,
  upcoming: <CalendarDays className="w-3 h-3" strokeWidth={2} />,
  mastered: <Star className="w-3 h-3" strokeWidth={2} fill="currentColor" />,
};

const difficultyConfig: Record<RevisionDifficulty, string> = {
  Easy: 'text-gray-500 dark:text-white/60',
  Medium: 'text-gray-600 dark:text-white/70',
  Hard: 'text-gray-700 dark:text-white/80',
};

interface RevisionProps {
  /** All goals — used to pull spaced-repetition items from EVERY active
   *  goal's roadmap at once, so revision covers both simultaneous goals
   *  instead of only whichever one Roadmap.tsx's tab happens to be on. */
  goals?: Goal[];
}

export default function Revision({ goals = [] }: RevisionProps) {
  const t = useTranslation();
  const { locale } = useLanguage();
  const sp = studyPlanText[locale];
  const [mode, setMode] = useState<'roadmap' | 'files'>('roadmap');
  const statusLabels: Record<RevisionStatus, string> = {
    'due-today': t.revision.filters.dueToday,
    overdue: t.revision.filters.overdue,
    upcoming: t.revision.filters.upcoming,
    mastered: t.revision.filters.mastered,
  };
  const difficultyLabels: Record<RevisionDifficulty, string> = {
    Easy: t.revision.difficultyLabels.easy,
    Medium: t.revision.difficultyLabels.medium,
    Hard: t.revision.difficultyLabels.hard,
  };
  // Live-computed from the actual roadmap(s) (see revisionData.ts) — held in
  // state (not recomputed on every render) so "Mark Done" can trigger a
  // real refresh after persisting to revisionStore.
  const [items, setItems] = useState<(RevisionItem & { goalTitle?: string })[]>(() => getRevisionDataForGoals(t.revisionTasks, goals));
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // ON-DEMAND CLOUD HYDRATION: only pulled down when the Revision page is
  // actually opened, not upfront on sign-in. No-op if this device already
  // has revision data.
  useEffect(() => {
    void Promise.all([hydrateRevisionFromCloud(), hydrateRecallScoresFromCloud()]).then(() => {
      setItems(getRevisionDataForGoals(t.revisionTasks, goals));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marking done is now a real state change, not a cosmetic toggle: it
  // persists to revisionStore, and the item either moves to its next
  // schedule checkpoint or becomes "mastered" if that was the last one.
  const handleMarkDone = (item: RevisionItem & { goalId?: string }) => {
    if (item.status === 'mastered') return;
    markDayReviewed(item.topicId, item.day);
    const refreshed = getRevisionDataForGoals(t.revisionTasks, goals);
    setItems(refreshed);
    if (reviewingId === item.id) setReviewingId(null);

    // If that was the last checkpoint, the topic is now fully mastered —
    // propagate that to the roadmap so the next locked step unlocks too.
    const updated = refreshed.find((i) => i.topicId === item.topicId);
    if (updated?.status === 'mastered') {
      markTopicFinished(item.goalId, item.topicId, 'mastered');
    }
  };

  const handleReviewNow = (id: string) => {
    setReviewingId(id);
  };

  const handleRecallRating = (item: RevisionItem & { goalId?: string }, rating: RecallRating) => {
    saveRecallRating(item.topicId, item.day, rating);
    handleMarkDone(item);
  };

  // Only what the learner has to revise NOW (already sorted overdue first).
  // Upcoming and mastered checkpoints are deliberately not shown here.
  const dueItems = items.filter((i) => i.status === 'overdue' || i.status === 'due-today');

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto text-black dark:text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 md:mb-8">
        <div className="flex items-center gap-3">
          <RotateCcw className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.75} />
          <h1 className="text-2xl md:text-4xl font-bold">{t.revision.header.title}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-white/60 mt-1">{mode === 'files' ? sp.subtitle : t.revision.header.subtitle}</p>
      </motion.div>

      {/* Source switch: roadmap topics vs the learner's own files */}
      <div className="flex border-b border-gray-200 dark:border-white/10 mb-5 md:mb-6">
        {([['roadmap', sp.tabRoadmap, Route], ['files', sp.tabFiles, FileText]] as const).map(([id, text, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            aria-label={text}
            title={text}
            aria-pressed={mode === id}
            className={`flex-1 h-12 flex items-center justify-center gap-2 border-b-2 transition ${
              mode === id
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white'
            }`}
          >
            <Icon className="w-6 h-6" strokeWidth={mode === id ? 2.2 : 1.75} />
            <span className="hidden md:inline text-sm font-medium">{text}</span>
          </button>
        ))}
      </div>

      {mode === 'files' ? (
        <StudyPlan />
      ) : (
        <>
      <NotesToRevise />
      {/* Revision cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {dueItems.map((item, i) => {
            const statusIcon = statusIcons[item.status];
            const statusLabel = statusLabels[item.status];
            const isReviewing = reviewingId === item.id;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`p-4 md:p-5 rounded-2xl border card transition-all ${
                  isReviewing ? 'border-indigo-400 dark:border-indigo-400/60' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/50">{t.revision.card.day}</span>
                    <span className="text-lg md:text-2xl font-bold">{item.day}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70" title={statusLabel} aria-label={statusLabel}>
                        {statusIcon}<span className="hidden md:inline">{statusLabel}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">• {item.category}</span>
                      {item.goalTitle && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 max-w-[160px]">
                          <Target className="w-3 h-3 flex-shrink-0" strokeWidth={2} /><span className="truncate">{item.goalTitle}</span>
                        </span>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider ${difficultyConfig[item.difficulty]}`}>
                        • {difficultyLabels[item.difficulty]}
                      </span>
                      {isReviewing && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white">
                          {t.revision.card.reviewingNow}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{item.topic}</h3>
                    {item.status !== 'mastered' && (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/60 mb-1"><PenLine className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} /><span className="min-w-0">{item.task}</span></p>
                    )}
                    {isReviewing && item.status !== 'mastered' && (
                      <div className="mt-3 flex flex-wrap gap-2" aria-label="How well did you recall this topic?">
                        <span className="w-full text-xs text-gray-500 dark:text-white/60">How well did you remember it?</span>
                        {([
                          ['forgot', 'Forgot'],
                          ['partial', 'Some of it'],
                          ['remembered', 'Remembered'],
                        ] as [RecallRating, string][]).map(([rating, label]) => (
                          <button key={rating} onClick={() => handleRecallRating(item, rating)} className="rounded-full border border-gray-200 dark:border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-500/15 transition">
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-white/50">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" strokeWidth={1.75} />{item.dueDate}</span>
                      <span>•</span>
                      <span>{format(t.revision.card.retentionLabel, item.retention)}</span>
                    </div>

                    <div className="mt-2 h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.retention}%` }}
                        transition={{ delay: 0.2 + i * 0.05, duration: 0.8 }}
                        className="h-full bg-black dark:bg-white rounded-full"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {item.status === 'mastered' ? (
                      <span className="w-11 h-11 md:w-auto md:h-auto md:px-3 md:py-1.5 flex items-center justify-center rounded-full md:rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-center" title={t.revision.card.doneLabel} aria-label={t.revision.card.doneLabel}>
                        <Check className="w-5 h-5 md:hidden" strokeWidth={2} />
                        <span className="hidden md:inline">{t.revision.card.doneLabel}</span>
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkDone(item)}
                          aria-label={t.revision.card.doneCta}
                          title={t.revision.card.doneCta}
                          className="w-11 h-11 md:w-auto md:h-auto md:px-3 md:py-1.5 flex items-center justify-center rounded-full md:rounded-lg text-xs font-medium transition-all border bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent hover:opacity-80"
                        >
                          <Check className="w-5 h-5 md:hidden" strokeWidth={2.2} />
                          <span className="hidden md:inline">{t.revision.card.doneCta}</span>
                        </button>
                        <button
                          onClick={() => handleReviewNow(item.id)}
                          aria-label={isReviewing ? t.revision.card.reviewingCta : t.revision.card.reviewNowCta}
                          title={isReviewing ? t.revision.card.reviewingCta : t.revision.card.reviewNowCta}
                          className="w-11 h-11 md:w-auto md:h-auto md:px-3 md:py-1.5 flex items-center justify-center rounded-full md:rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 text-xs font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
                        >
                          <Play className="w-5 h-5 md:hidden" strokeWidth={1.75} fill={isReviewing ? 'currentColor' : 'none'} />
                          <span className="hidden md:inline">{isReviewing ? t.revision.card.reviewingCta : t.revision.card.reviewNowCta}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {dueItems.length === 0 && items.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 md:p-12 text-center">
          <Sprout className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-white/40" strokeWidth={1.5} />
          <h3 className="text-xl font-semibold mb-2">{t.revision.emptyState.noRevisionTitle}</h3>
          <p className="text-gray-400 dark:text-white/60">{t.revision.emptyState.noRevisionBody}</p>
        </motion.div>
      )}
      {dueItems.length === 0 && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 md:p-12 text-center">
          <PartyPopper className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-white/40" strokeWidth={1.5} />
          <h3 className="text-xl font-semibold mb-2">{t.revision.emptyState.allCaughtUpTitle}</h3>
          <p className="text-gray-400 dark:text-white/60">{t.revision.emptyState.allCaughtUpBody}</p>
        </motion.div>
      )}
        </>
      )}
    </div>
  );
}