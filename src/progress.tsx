import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChartNoAxesColumn, Flame, Clock, Brain, Sprout, Target, Star, Check } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { hydrateTestAttemptsFromCloud } from './testStore';

interface ProgressProps {
  goals?: Goal[];
}

const masteryColor = (score: number): string => {
  if (score >= 80) return 'bg-indigo-600 dark:bg-indigo-400';
  if (score >= 60) return 'bg-indigo-400 dark:bg-indigo-400/70';
  if (score >= 40) return 'bg-indigo-200 dark:bg-indigo-400/30';
  return 'bg-indigo-100 dark:bg-white/10';
};

const statusIcon: Record<string, ReactNode> = {
  mastered: <Star className="w-3.5 h-3.5" fill="currentColor" strokeWidth={2} />,
  completed: <Check className="w-3.5 h-3.5" strokeWidth={2.5} />,
  learning: <Flame className="w-3.5 h-3.5" strokeWidth={2} />,
};

export default function Progress({ goals = [] }: ProgressProps) {
  const t = useTranslation();
  const [, setAttemptHydrationVersion] = useState(0);
  useEffect(() => {
    let active = true;
    void hydrateTestAttemptsFromCloud()
      .then(() => { if (active) setAttemptHydrationVersion((version) => version + 1); })
      .catch(() => { /* Local test history remains available when cloud sync is offline. */ });
    return () => { active = false; };
  }, []);
  const streak = getStreakStats();
  const completion = getCompletionStats(goals);
  const time = getTimeStats();
  const heatmap = getMasteryHeatmap(goals);
  const weakAreas = getWeakAreas(heatmap);
  const retention = getRetentionStats(t.revisionTasks, goals);

  const maxDailyMinutes = Math.max(1, ...time.dailyMinutes.map((d) => d.minutes));
  const hasAnyTopics = heatmap.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto text-black dark:text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 md:mb-8">
        <div className="flex items-center gap-3">
          <ChartNoAxesColumn className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.75} />
          <h1 className="text-2xl md:text-4xl font-bold">{t.progress.header.title}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-white/60 mt-1">{t.progress.header.subtitle}</p>
      </motion.div>

      {/* Hero: completion ring + key numbers */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="rounded-2xl card p-4 md:p-6 flex items-center gap-5 md:gap-10 mb-5 md:mb-6">
        <div className="relative w-28 h-28 md:w-36 md:h-36 flex-shrink-0" role="img" aria-label={`${t.progress.stats.completion}: ${completion.percent}%`}>
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-indigo-100 dark:stroke-white/10" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
              className="stroke-indigo-600 dark:stroke-indigo-400"
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - completion.percent / 100) }}
              transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-2xl md:text-3xl font-bold">{completion.percent}%</div>
        </div>
        <div className="flex-1 min-w-0 grid gap-3 md:gap-4">
          {[
            { label: t.progress.stats.streak, value: `${streak.currentStreak}d`, Icon: Flame },
            { label: t.progress.stats.totalWatchTime, value: `${time.totalHours}h`, Icon: Clock },
            { label: t.progress.stats.retention, value: `${retention.avgRetention}%`, Icon: Brain },
          ].map(({ label, value, Icon }) => (
            <div key={label} title={label} aria-label={`${label}: ${value}`} className="flex items-center gap-3 min-w-0">
              <Icon className="w-5 h-5 flex-shrink-0 text-gray-500 dark:text-white/50" strokeWidth={1.75} />
              <span className="text-lg md:text-xl font-bold tabular-nums">{value}</span>
              <span className="hidden md:inline text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider truncate">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Completion progress bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }} className="mb-6 md:mb-10">
        <div className="flex justify-between text-xs text-gray-400 dark:text-white/40 mb-2">
          <span>{format(t.progress.completionBar.topicsDone, completion.completed, completion.total)}</span>
          <span>{format(t.progress.completionBar.inProgress, completion.learning)}</span>
        </div>
        <div className="h-2 bg-indigo-100 dark:bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completion.percent}%` }}
            transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
          />
        </div>
      </motion.div>

      {!hasAnyTopics ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 md:p-12 text-center rounded-2xl card">
          <Sprout className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-white/40" strokeWidth={1.5} />
          <h3 className="text-xl font-semibold mb-2">{t.progress.emptyState.title}</h3>
          <p className="text-gray-400 dark:text-white/60">{t.progress.emptyState.body}</p>
        </motion.div>
      ) : (
        <>
          {/* Time tracking — last 7 days */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="p-4 md:p-6 rounded-2xl card mb-4 md:mb-6">
            <div className="flex items-center justify-between mb-3 md:mb-5">
              <h2 className="font-semibold">{t.progress.timeTracking.title}</h2>
              <span className="text-xs text-gray-400 dark:text-white/40">{format(t.progress.timeTracking.last7Days, time.last7DaysMinutes)}</span>
            </div>
            <div className="flex items-end justify-between gap-2 md:h-28">
              {time.dailyMinutes.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-14 md:h-20 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, (d.minutes / maxDailyMinutes) * 100)}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                      className="w-full rounded-t-md bg-indigo-500 dark:bg-indigo-400"
                      title={`${d.minutes} min`}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-white/40">{d.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
            {/* Mastery heatmap */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }} className="p-4 md:p-6 rounded-2xl card">
              <h2 className="font-semibold mb-3 md:mb-5">{t.progress.masteryHeatmap.title}</h2>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 gap-2">
                {heatmap.map((topic) => (
                  <div
                    key={topic.topicId}
                    title={`${topic.title} — ${topic.masteryScore}%${topic.observedRecall === null ? ' estimated from progress' : ` observed recall from ${topic.recallAttempts} rating(s)`}${topic.testAccuracy === null ? '' : `; test accuracy ${topic.testAccuracy}% from ${topic.testAttempts} recent test(s)`}`}
                    className={`aspect-[5/4] md:aspect-square rounded-lg ${masteryColor(topic.masteryScore)} flex items-center justify-center text-[10px] font-medium ${topic.masteryScore >= 60 ? 'text-white dark:text-black' : 'text-indigo-400 dark:text-white/60'}`}
                  >
                    {statusIcon[topic.status] ?? ''}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4 text-[10px] text-gray-400 dark:text-white/40">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-100 dark:bg-white/10 inline-block" /> {t.progress.masteryHeatmap.legendWeak}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-400 dark:bg-indigo-400/70 inline-block" /> {t.progress.masteryHeatmap.legendOk}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-600 dark:bg-indigo-400 inline-block" /> {t.progress.masteryHeatmap.legendStrong}</span>
              </div>
            </motion.div>

            {/* Retention detail */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="p-4 md:p-6 rounded-2xl card">
              <h2 className="font-semibold mb-3 md:mb-5">{t.progress.retentionDetail.title}</h2>
              <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${retention.avgRetention}%` }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="p-4 md:p-6 rounded-2xl card">
            <h2 className="font-semibold mb-3 md:mb-5">{t.progress.weakAreas.title}</h2>
            {weakAreas.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/50">{t.progress.weakAreas.noneFound}</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/10">
                {weakAreas.map((topic) => (
                  <div key={topic.topicId} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{topic.title}</div>
                      <div className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">
                        {topic.difficulty}
                        {topic.goalTitle && (
                          <span className="inline-flex items-center gap-1 ml-1">
                            • <Target className="w-3 h-3" strokeWidth={2} /> {topic.goalTitle}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="text-sm font-bold">{topic.masteryScore}%</div>
                      <div className="text-[10px] text-gray-400 dark:text-white/40">{topic.observedRecall === null ? 'Progress estimate' : `Recall · ${topic.recallAttempts}`}</div>
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
