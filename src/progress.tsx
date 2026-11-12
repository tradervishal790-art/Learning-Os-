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
import { GlassPanel, Heatmap, HeatmapLegend, ProgressRing, readActiveDays } from './ui/kit';

interface ProgressProps {
  goals?: Goal[];
}

const masteryColor = (score: number): string => {
  if (score >= 80) return 'bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.5)]';
  if (score >= 60) return 'bg-violet-400/60';
  if (score >= 40) return 'bg-violet-400/30';
  return 'bg-white/10';
};

const statusIcon: Record<string, ReactNode> = {
  mastered: <Star className="w-3.5 h-3.5" fill="currentColor" strokeWidth={2} />,
  completed: <Check className="w-3.5 h-3.5" strokeWidth={2.5} />,
  learning: <Flame className="w-3.5 h-3.5" strokeWidth={2} />,
};

export default function Progress({ goals = [] }: ProgressProps) {
  const t = useTranslation();
  const hub = t.dashboard.home.hub;
  const [, setAttemptHydrationVersion] = useState(0);
  useEffect(() => {
    let active = true;
    void hydrateTestAttemptsFromCloud()
      .then(() => { if (active) setAttemptHydrationVersion((version) => version + 1); })
      .catch(() => { /* Local test history remains available when cloud sync is offline. */ });
    return () => { active = false; };
  }, []);
  const streak = getStreakStats();
  const activeDays = readActiveDays();
  const completion = getCompletionStats(goals);
  const time = getTimeStats();
  const heatmap = getMasteryHeatmap(goals);
  const weakAreas = getWeakAreas(heatmap);
  const retention = getRetentionStats(t.revisionTasks, goals);

  const maxDailyMinutes = Math.max(1, ...time.dailyMinutes.map((d) => d.minutes));
  const hasAnyTopics = heatmap.length > 0;

  return (
    <div className="dark">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-none bg-transparent md:bg-[#080d19] px-4 pb-4 pt-2 text-slate-100 md:mb-4 md:mt-0 md:rounded-3xl md:px-8 md:pb-8 md:pt-3">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hidden md:block absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-violet-600/[0.12] blur-[120px]" />
        <div className="hidden md:block absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-emerald-500/[0.08] blur-[120px]" />
      </div>
      <div className="relative">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 md:mb-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200"><ChartNoAxesColumn className="h-5 w-5" strokeWidth={1.75} /></span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{t.progress.header.title}</h1>
            <p className="mt-0.5 text-sm text-slate-400">{t.progress.header.subtitle}</p>
          </div>
        </div>
      </motion.div>

      {/* Hero: completion ring + key numbers, next to the consistency heatmap */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="mb-4 grid gap-4 md:mb-6 lg:grid-cols-12">
        <GlassPanel accent="#a78bfa" className="border-violet-300/20 bg-gradient-to-br from-violet-500/[0.10] to-transparent lg:col-span-7">
          <div className="flex items-center gap-5 p-4 md:gap-8 md:p-6">
            <div role="img" aria-label={`${t.progress.stats.completion}: ${completion.percent}%`}>
              <ProgressRing value={completion.percent} size={132} stroke={10} color="#a78bfa">
                <span className="text-3xl font-semibold tabular-nums text-white">{completion.percent}%</span>
                <span className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-slate-500">{t.progress.stats.completion}</span>
              </ProgressRing>
            </div>
            <div className="grid min-w-0 flex-1 gap-3">
              {[
                { label: t.progress.stats.streak, value: `${streak.currentStreak}d`, Icon: Flame, tone: 'text-amber-300' },
                { label: t.progress.stats.totalStudyTime, value: `${time.totalHours}h`, Icon: Clock, tone: 'text-cyan-300' },
                { label: t.progress.stats.retention, value: `${retention.avgRetention}%`, Icon: Brain, tone: 'text-emerald-300' },
              ].map(({ label, value, Icon, tone }) => (
                <div key={label} title={label} aria-label={`${label}: ${value}`} className="flex min-w-0 items-center gap-3">
                  <Icon className={`h-5 w-5 flex-shrink-0 ${tone}`} strokeWidth={1.75} />
                  <span className="text-lg font-semibold tabular-nums md:text-xl">{value}</span>
                  <span className="hidden truncate text-xs uppercase tracking-wider text-slate-500 md:inline">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/[0.07] px-4 py-3 md:px-6">
            <div className="mb-2 flex justify-between text-xs text-slate-400">
              <span>{format(t.progress.completionBar.topicsDone, completion.completed, completion.total)}</span>
              <span>{format(t.progress.completionBar.inProgress, completion.learning)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completion.percent}%` }}
                transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 shadow-[0_0_10px_rgba(139,92,246,.6)]"
              />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel accent="#6ee7b7" className="lg:col-span-5">
          <div className="flex h-full flex-col justify-between gap-3 p-4 md:p-5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">{hub.consistencyTitle}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{format(hub.consistencyRange, 12)}</div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums text-white">{streak.currentStreak}</span>
                <span className="text-[11px] text-slate-400">{hub.dayStreakLabel}</span>
              </div>
            </div>
            <Heatmap days={activeDays} weeks={12} color="#6ee7b7" />
            <div className="flex justify-end"><HeatmapLegend less={hub.less} more={hub.more} color="#6ee7b7" /></div>
          </div>
        </GlassPanel>
      </motion.div>

      {!hasAnyTopics ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-8 text-center md:p-12">
          <Sprout className="mx-auto mb-4 h-12 w-12 text-slate-500" strokeWidth={1.5} />
          <h3 className="mb-2 text-xl font-semibold">{t.progress.emptyState.title}</h3>
          <p className="text-slate-400">{t.progress.emptyState.body}</p>
        </motion.div>
      ) : (
        <>
          {/* Time tracking — last 7 days */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="mb-4 md:mb-6">
            <GlassPanel accent="#67e8f9">
              <div className="p-4 md:p-6">
                <div className="mb-3 flex items-center justify-between md:mb-5">
                  <h2 className="font-semibold">{t.progress.timeTracking.title}</h2>
                  <span className="text-xs text-slate-500">{format(t.progress.timeTracking.last7Days, time.last7DaysMinutes)}</span>
                </div>
                <div className="flex items-end justify-between gap-2 md:h-28">
                  {time.dailyMinutes.map((d, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-14 w-full items-end md:h-20">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(4, (d.minutes / maxDailyMinutes) * 100)}%` }}
                          transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                          className="w-full rounded-t-md bg-gradient-to-t from-violet-500 to-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.35)]"
                          title={format(t.progress.timeTracking.minutesTitle, d.minutes)}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassPanel>
          </motion.div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:mb-6 md:grid-cols-2 md:gap-6">
            {/* Mastery heatmap */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>
              <GlassPanel accent="#a78bfa" className="h-full">
                <div className="p-4 md:p-6">
                  <h2 className="mb-3 font-semibold md:mb-5">{t.progress.masteryHeatmap.title}</h2>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-5">
                    {heatmap.map((topic) => (
                      <div
                        key={topic.topicId}
                        role="img"
                        aria-label={format(t.progress.masteryHeatmap.aria, topic.title, topic.masteryScore)}
                        title={[
                          `${topic.title} — ${topic.masteryScore}%`,
                          topic.observedRecall === null ? t.progress.masteryHeatmap.estimated : format(t.progress.masteryHeatmap.observed, topic.recallAttempts),
                          topic.testAccuracy === null ? '' : format(t.progress.masteryHeatmap.testAcc, topic.testAccuracy, topic.testAttempts),
                        ].filter(Boolean).join('; ')}
                        className={`flex aspect-[5/4] items-center justify-center rounded-lg text-[10px] font-medium transition-transform duration-150 hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100 md:aspect-square ${masteryColor(topic.masteryScore)} ${topic.masteryScore >= 60 ? 'text-slate-900' : 'text-violet-200/70'}`}
                      >
                        {statusIcon[topic.status] ?? ''}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-white/10" /> {t.progress.masteryHeatmap.legendWeak}</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-violet-400/60" /> {t.progress.masteryHeatmap.legendOk}</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-violet-400" /> {t.progress.masteryHeatmap.legendStrong}</span>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>

            {/* Retention detail */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
              <GlassPanel accent="#34d399" className="h-full">
                <div className="p-4 md:p-6">
                  <h2 className="mb-3 font-semibold md:mb-5">{t.progress.retentionDetail.title}</h2>
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${retention.avgRetention}%` }}
                      transition={{ delay: 0.4, duration: 0.8 }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_10px_rgba(52,211,153,.5)]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: t.progress.retentionDetail.dueToday, value: retention.dueToday, tone: 'text-amber-300' },
                      { label: t.progress.retentionDetail.overdue, value: retention.overdue, tone: 'text-red-300' },
                      { label: t.progress.retentionDetail.mastered, value: retention.mastered, tone: 'text-emerald-300' },
                    ].map((tile) => (
                      <div key={tile.label}>
                        <div className={`text-2xl font-semibold tabular-nums ${tile.tone}`}>{tile.value}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">{tile.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          </div>

          {/* Weak areas */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
            <GlassPanel accent="#f87171">
              <div className="p-4 md:p-6">
                <h2 className="mb-3 font-semibold md:mb-5">{t.progress.weakAreas.title}</h2>
                {weakAreas.length === 0 ? (
                  <p className="text-sm text-slate-400">{t.progress.weakAreas.noneFound}</p>
                ) : (
                  <div className="divide-y divide-white/[0.07]">
                    {weakAreas.map((topic) => (
                      <div key={topic.topicId} className="flex items-center justify-between py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{topic.title}</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            {topic.difficulty}
                            {topic.goalTitle && (
                              <span className="ml-1 inline-flex items-center gap-1">
                                • <Target className="h-3 w-3" strokeWidth={2} /> {topic.goalTitle}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-3 flex-shrink-0 text-right">
                          <div className={`text-sm font-semibold tabular-nums ${topic.masteryScore < 40 ? 'text-red-300' : 'text-amber-300'}`}>{topic.masteryScore}%</div>
                          <div className="text-[10px] text-slate-500">{topic.observedRecall === null ? t.progress.weakAreas.progressEstimate : format(t.progress.weakAreas.recallCount, topic.recallAttempts)}</div>
                          <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                            <div className={`h-full rounded-full ${topic.masteryScore < 40 ? 'bg-red-400' : 'bg-amber-300'}`} style={{ width: `${topic.masteryScore}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        </>
      )}
      </div>
    </div>
    </div>
  );
}
