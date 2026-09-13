import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRevisionStats, getRevisionDataForGoals } from './revisionData';
import { markDayReviewed } from './revisionstore';
import { markTopicFinished } from './roadmapData';
import type { RevisionStatus, RevisionDifficulty, RevisionItem, Goal } from './types';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';

const statusIcons: Record<RevisionStatus, string> = {
  'due-today': '🔥',
  overdue: '⚠️',
  upcoming: '📅',
  mastered: '⭐',
};

const difficultyConfig: Record<RevisionDifficulty, string> = {
  Easy: 'text-gray-500 dark:text-white/60',
  Medium: 'text-gray-600 dark:text-white/70',
  Hard: 'text-gray-700 dark:text-white/80',
};

type FilterId = 'all' | RevisionStatus;

interface RevisionProps {
  /** All goals — used to pull spaced-repetition items from EVERY active
   *  goal's roadmap at once, so revision covers both simultaneous goals
   *  instead of only whichever one Roadmap.tsx's tab happens to be on. */
  goals?: Goal[];
}

export default function Revision({ goals = [] }: RevisionProps) {
  const t = useTranslation();
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
  const [filter, setFilter] = useState<FilterId>('all');
  // Live-computed from the actual roadmap(s) (see revisionData.ts) — held in
  // state (not recomputed on every render) so "Mark Done" can trigger a
  // real refresh after persisting to revisionStore.
  const [items, setItems] = useState<(RevisionItem & { goalTitle?: string })[]>(() => getRevisionDataForGoals(t.revisionTasks, goals));
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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
    // TODO: once Mentor is wired in, this should open a quiz/explanation
    // session for the topic instead of just flagging it as "in review".
  };

  const stats = getRevisionStats(items);

  const filteredItems = filter === 'all' ? items : items.filter((i) => i.status === filter);

  return (
    <div className="p-8 max-w-6xl mx-auto text-black dark:text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔄</span>
          <h1 className="text-3xl md:text-4xl font-bold">{t.revision.header.title}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-white/60 mt-1">{t.revision.header.subtitle}</p>
      </motion.div>

      {/* Top stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.revision.stats.dueToday}</div>
          <div className="text-3xl font-bold">{stats.dueToday}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.revision.stats.overdue}</div>
          <div className="text-3xl font-bold">{stats.overdue}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.revision.stats.mastered}</div>
          <div className="text-3xl font-bold">{stats.mastered}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.revision.stats.retention}</div>
          <div className="text-3xl font-bold">{stats.avgRetention}%</div>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(
          [
            { id: 'all', label: t.revision.filters.all, count: stats.total },
            { id: 'due-today', label: t.revision.filters.dueToday, count: stats.dueToday },
            { id: 'overdue', label: t.revision.filters.overdue, count: stats.overdue },
            { id: 'upcoming', label: t.revision.filters.upcoming, count: stats.upcoming },
            { id: 'mastered', label: t.revision.filters.mastered, count: stats.mastered },
          ] as { id: FilterId; label: string; count: number }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
              filter === tab.id
                ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            {tab.label} <span className="opacity-60">({tab.count})</span>
          </button>
        ))}
      </motion.div>

      {/* Revision cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredItems.map((item, i) => {
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
                className={`p-5 rounded-2xl border bg-gray-50 dark:bg-white/5 transition-all ${
                  isReviewing ? 'border-black dark:border-white' : 'border-gray-200 dark:border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/50">{t.revision.card.day}</span>
                    <span className="text-2xl font-bold">{item.day}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70">
                        {statusIcon} {statusLabel}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">• {item.category}</span>
                      {item.goalTitle && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50">
                          🎯 {item.goalTitle}
                        </span>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider ${difficultyConfig[item.difficulty]}`}>
                        • {difficultyLabels[item.difficulty]}
                      </span>
                      {isReviewing && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black text-white dark:bg-white dark:text-black">
                          {t.revision.card.reviewingNow}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{item.topic}</h3>
                    {item.status !== 'mastered' && (
                      <p className="text-xs text-gray-500 dark:text-white/60 mb-1">📝 {item.task}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-white/50">
                      <span>📅 {item.dueDate}</span>
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
                      <span className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-center">
                        {t.revision.card.doneLabel}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkDone(item)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-black text-white dark:bg-white dark:text-black border-transparent hover:opacity-80"
                        >
                          {t.revision.card.doneCta}
                        </button>
                        <button
                          onClick={() => handleReviewNow(item.id)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 text-xs font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
                        >
                          {isReviewing ? t.revision.card.reviewingCta : t.revision.card.reviewNowCta}
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

      {filteredItems.length === 0 && items.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
          <div className="text-5xl mb-4">🌱</div>
          <h3 className="text-xl font-semibold mb-2">{t.revision.emptyState.noRevisionTitle}</h3>
          <p className="text-gray-400 dark:text-white/60">{t.revision.emptyState.noRevisionBody}</p>
        </motion.div>
      )}
      {filteredItems.length === 0 && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold mb-2">{t.revision.emptyState.allCaughtUpTitle}</h3>
          <p className="text-gray-400 dark:text-white/60">{t.revision.emptyState.allCaughtUpBody}</p>
        </motion.div>
      )}
    </div>
  );
}