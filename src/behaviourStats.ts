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
  daysAway: number; // days since the last active day BEFORE today (0 = was here yesterday)
}

// The dashboard marks today as active the moment it opens, so "streak = 0" never
// happens while the learner is looking at it. A gap before today is the real signal.
export function getDaysAway(): number {
  let days: string[] = [];
  try {
    days = JSON.parse(localStorage.getItem('learning_os_active_days') || '[]') as string[];
  } catch {
    days = [];
  }
  const today = new Date().toISOString().slice(0, 10);
  const prev = days.filter((d) => d < today).sort().pop();
  if (!prev) return 0;
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(prev)) / 86400000) - 1);
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
    daysAway: getDaysAway(),
  };
}
