// src/behaviourStats.ts
//
// Non-test behaviour the growth-edge rules can confirm a personality bucket with.
// Reads the SAME on-device stores the Progress page uses — no new storage, no AI.
import type { Goal } from './types';
import type { TranslationShape } from './i18n/translations';
import { getStreakStats, getTimeStats, getCompletionStats } from './progressData';
import { getRevisionDataForGoals } from './revisionData';

export interface BehaviourStats {
  overdueRevisions: number;
  currentStreak: number;
  totalActiveDays: number;
  watchMinutes7d: number;
  learningTopics: number; // topics started but not finished
}

export function getBehaviourStats(revisionTasks: TranslationShape['revisionTasks'], goals: Goal[]): BehaviourStats {
  const streak = getStreakStats();
  const items = getRevisionDataForGoals(revisionTasks, goals);
  return {
    overdueRevisions: items.filter((i) => i.status === 'overdue').length,
    currentStreak: streak.currentStreak,
    totalActiveDays: streak.totalActiveDays,
    watchMinutes7d: getTimeStats().last7DaysMinutes,
    learningTopics: getCompletionStats(goals).learning,
  };
}
