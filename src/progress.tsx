import { motion } from 'framer-motion';
import type { Goal } from './types';
import {
  getStreakStats,
  getCompletionStats,
  getTimeStats,
  getMasteryHeatmap,
  getWeakAreas,
  getRetentionStats,
} from './progressData';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';

interface ProgressProps {
  goals?: Goal[];
}

const masteryColor = (score: number): string => {
  if (score >= 80) return 'bg-black dark:bg-white';
  if (score >= 60) return 'bg-gray-500 dark:bg-white/60';
  if (score >= 40) return 'bg-gray-300 dark:bg-white/30';
  return 'bg-gray-200 dark:bg-white/10';
};

const statusIcon: Record<string, string> = {
  mastered: '⭐',
  completed: '✓',
  learning: '🔥',
};

export default function Progress({ goals = [] }: ProgressProps) {
  const t = useTranslation();
  const streak = getStreakStats();
  const completion = getCompletionStats(goals);
  const time = getTimeStats();
  const heatmap = getMasteryHeatmap(goals);
  const weakAreas = getWeakAreas(heatmap);
  const retention = getRetentionStats(t.revisionTasks, goals);

  const maxDailyMinutes = Math.max(1, ...time.dailyMinutes.map((d) => d.minutes));
  const hasAnyTopics = heatmap.length > 0;

  return (
    <div className="p-8 max-w-6xl mx-auto text-black dark:text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <h1 className="text-3xl md:text-4xl font-bold">{t.progress.header.title}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-white/60 mt-1">{t.progress.header.subtitle}</p>
      </motion.div>

      {/* Top stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.progress.stats.completion}</div>
          <div className="text-2xl font-bold">{completion.percent}%</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.progress.stats.streak}</div>
          <div className="text-2xl font-bold">🔥 {streak.currentStreak}d</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.progress.stats.totalWatchTime}</div>
          <div className="text-2xl font-bold">{time.totalHours}h</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">{t.progress.stats.retention}</div>
          <div className="text-2xl font-bold">{retention.avgRetention}%</div>
        </div>
      </motion.div>

      {/* Completion progress bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }} className="mb-10">
        <div className="flex justify-between text-xs text-gray-400 dark:text-white/40 mb-2">
          <span>{format(t.progress.completionBar.topicsDone, completion.completed, completion.total)}</span>
          <span>{format(t.progress.completionBar.inProgress, completion.learning)}</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completion.percent}%` }}
            transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
            className="h-full bg-black dark:bg-white rounded-full"
          />
        </div>
      </motion.div>

      {!hasAnyTopics ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-5xl mb-4">🌱</div>
          <h3 className="text-xl font-semibold mb-2">{t.progress.emptyState.title}</h3>
          <p className="text-gray-400 dark:text-white/60">{t.progress.emptyState.body}</p>
        </motion.div>
      ) : (
        <>
          {/* Time tracking — last 7 days */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">{t.progress.timeTracking.title}</h2>
              <span className="text-xs text-gray-400 dark:text-white/40">{format(t.progress.timeTracking.last7Days, time.last7DaysMinutes)}</span>
            </div>
            <div className="flex items-end justify-between gap-2 h-28">
              {time.dailyMinutes.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-20 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, (d.minutes / maxDailyMinutes) * 100)}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                      className="w-full rounded-t-md bg-black dark:bg-white"
                      title={`${d.minutes} min`}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-white/40">{d.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Mastery heatmap */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }} className="p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
              <h2 className="font-semibold mb-5">{t.progress.masteryHeatmap.title}</h2>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {heatmap.map((topic) => (
                  <div
                    key={topic.topicId}
                    title={`${topic.title} — ${topic.masteryScore}%`}
                    className={`aspect-square rounded-lg ${masteryColor(topic.masteryScore)} flex items-center justify-center text-[10px] font-medium ${topic.masteryScore >= 60 ? 'text-white dark:text-black' : 'text-gray-500 dark:text-white/60'}`}
                  >
                    {statusIcon[topic.status] ?? ''}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4 text-[10px] text-gray-400 dark:text-white/40">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-200 dark:bg-white/10 inline-block" /> {t.progress.masteryHeatmap.legendWeak}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-500 dark:bg-white/60 inline-block" /> {t.progress.masteryHeatmap.legendOk}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-black dark:bg-white inline-block" /> {t.progress.masteryHeatmap.legendStrong}</span>
              </div>
            </motion.div>

            {/* Retention detail */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
              <h2 className="font-semibold mb-5">{t.progress.retentionDetail.title}</h2>
              <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${retention.avgRetention}%` }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="h-full bg-black dark:bg-white rounded-full"
                />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold">{retention.dueToday}</div>
                  <div className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">{t.progress.retentionDetail.dueToday}</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{retention.overdue}</div>
                  <div className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">{t.progress.retentionDetail.overdue}</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{retention.mastered}</div>
                  <div className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">{t.progress.retentionDetail.mastered}</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Weak areas */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
            <h2 className="font-semibold mb-5">{t.progress.weakAreas.title}</h2>
            {weakAreas.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/50">{t.progress.weakAreas.noneFound}</p>
            ) : (
              <div className="space-y-3">
                {weakAreas.map((topic) => (
                  <div key={topic.topicId} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/10">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{topic.title}</div>
                      <div className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">
                        {topic.difficulty}{topic.goalTitle ? ` • 🎯 ${topic.goalTitle}` : ''}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="text-sm font-bold">{topic.masteryScore}%</div>
                      <div className="w-16 h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mt-1">
                        <div className={`h-full ${masteryColor(topic.masteryScore)}`} style={{ width: `${topic.masteryScore}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
