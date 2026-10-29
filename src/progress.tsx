import { motion, useReducedMotion } from 'framer-motion';
import { ChartNoAxesColumn, Flame, Clock, Brain, Sprout, Target, Star, Check, ArrowRight } from 'lucide-react';
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

interface ProgressProps {
  goals?: Goal[];
  onNavigateToRoadmap?: () => void;
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

export default function Progress({ goals = [], onNavigateToRoadmap }: ProgressProps) {
  const t = useTranslation();
  const prefersReducedMotion = useReducedMotion();
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

      {!hasAnyTopics ? (
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950 sm:p-9"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-indigo-100/70 blur-3xl dark:bg-indigo-500/10" />
          <div className="relative mx-auto flex max-w-xl flex-col items-start">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
              <Sprout className="h-6 w-6" strokeWidth={1.7} />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Your learning journey</p>
            <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-3xl">Your progress starts with one topic.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-gray-600 dark:text-white/60">
              Choose something to learn. Your study time, consistency, and topics you master will appear here as you go.
            </p>
            {onNavigateToRoadmap && (
              <button type="button" onClick={onNavigateToRoadmap} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:bg-indigo-800">
                Choose a learning topic <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <div className="mt-8 grid w-full grid-cols-1 gap-3 border-t border-gray-100 pt-5 dark:border-white/10 sm:grid-cols-3">
              {[
                { Icon: Clock, title: 'Study time', detail: 'Track your sessions' },
                { Icon: Flame, title: 'Consistency', detail: 'Build a steady habit' },
                { Icon: Brain, title: 'Mastery', detail: 'See what you retain' },
              ].map(({ Icon, title, detail }) => (
                <div key={title} className="flex items-start gap-3 rounded-xl bg-gray-50/80 p-3 dark:bg-white/[0.035] sm:flex-col sm:gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-white/50" strokeWidth={1.8} />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/85">{title}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      ) : (
        <>
          {/* Progress overview: real metrics, with labels visible on every screen size. */}
          <motion.div id="progress-overview" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="rounded-2xl card p-4 md:p-6 flex items-center gap-4 md:gap-8 mb-5 md:mb-6">
            <div className="relative h-24 w-24 flex-shrink-0 md:h-32 md:w-32" role="img" aria-label={`${t.progress.stats.completion}: ${completion.percent}%`}>
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-indigo-100 dark:stroke-white/10" />
                <motion.circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-indigo-600 dark:stroke-indigo-400" strokeDasharray={2 * Math.PI * 42} initial={prefersReducedMotion ? false : { strokeDashoffset: 2 * Math.PI * 42 }} animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - completion.percent / 100) }} transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeOut' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{completion.percent}%</div>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {[
                { label: t.progress.stats.streak, value: `${streak.currentStreak}d`, Icon: Flame },
                { label: t.progress.stats.totalWatchTime, value: `${time.totalHours}h`, Icon: Clock },
                { label: t.progress.stats.retention, value: `${retention.avgRetention}%`, Icon: Brain },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.035] sm:flex-col sm:items-start">
                  <Icon className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-300" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <div className="text-xl font-semibold tabular-nums">{value}</div>
                    <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-white/55">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          <div className="mb-6 md:mb-8">
            <div className="mb-2 flex justify-between gap-3 text-xs text-gray-500 dark:text-white/50">
              <span>{format(t.progress.completionBar.topicsDone, completion.completed, completion.total)}</span>
              <span>{format(t.progress.completionBar.inProgress, completion.learning)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-white/5">
              <motion.div initial={prefersReducedMotion ? false : { width: 0 }} animate={{ width: `${completion.percent}%` }} transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
          </div>
          {/* Time tracking — last 7 days */}
          <motion.div id="progress-activity" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="scroll-mt-24 p-4 md:p-6 rounded-2xl card mb-4 md:mb-6">
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
            <motion.div id="progress-mastery" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="scroll-mt-24 p-4 md:p-6 rounded-2xl card">
              <h2 className="font-semibold mb-3 md:mb-5">{t.progress.masteryHeatmap.title}</h2>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 gap-2">
                {heatmap.map((topic) => (
                  <div
                    key={topic.topicId}
                    title={`${topic.title} — ${topic.masteryScore}%${topic.observedRecall === null ? ' estimated from progress' : ` observed recall from ${topic.recallAttempts} rating(s)`}`}
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
            <motion.div id="progress-retention" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="scroll-mt-24 p-4 md:p-6 rounded-2xl card">
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
          <motion.div id="progress-focus" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="scroll-mt-24 p-4 md:p-6 rounded-2xl card">
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
