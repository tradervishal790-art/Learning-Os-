// ============================================================
// goalsStore.ts
// Manages the user's goal(s) — up to MAX_ACTIVE_GOALS running at once.
// Each Goal owns a separate roadmap, keyed by goal id (see roadmapData.ts's
// storageKeyFor). Ending a goal just flips its status — the roadmap and
// revision history stay in localStorage so nothing is lost.
//
// Backward compatibility: before this feature, there was exactly one
// roadmap saved under the flat key GENERATED_ROADMAP_STORAGE_KEY. Rather
// than migrating that data, the first-ever goal is always given the id
// 'primary', and roadmapData.ts treats goalId 'primary' as an alias for
// that original flat key. So existing users' roadmaps keep working with
// zero data movement.
// ============================================================

import type { Goal, GoalStatus, UserOnboardingData } from './types';

const GOALS_STORAGE_KEY = 'learning_os_goals';
export const MAX_ACTIVE_GOALS = 2;

function load(): Goal[] {
  try {
    const saved = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]): void {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // Storage full/unavailable — non-critical, just won't persist.
  }
}

/**
 * Reads saved goals. On the very first call after this feature ships (no
 * `learning_os_goals` key yet), wraps the user's existing single
 * goal/roadmap as a 'primary' Goal so old users don't lose anything.
 */
export function getGoals(userData: UserOnboardingData | null): Goal[] {
  const existing = load();
  if (existing.length > 0) return existing;
  if (!userData) return [];

  const primary: Goal = {
    id: 'primary',
    title: userData.goal,
    hours: userData.hours,
    deadline: userData.deadline,
    deadlineDays: userData.deadlineDays,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  saveGoals([primary]);
  return [primary];
}

export function getActiveGoals(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.status === 'active');
}

/** Adds a new empty goal (no roadmap yet — Roadmap.tsx's existing
 *  "Kya seekhna hai?" empty-state form fills it in). Caller must check
 *  getActiveGoals().length < MAX_ACTIVE_GOALS before calling this. */
export function addGoal(goals: Goal[], partial: Partial<Goal> = {}): { goals: Goal[]; goal: Goal } {
  const goal: Goal = {
    id: `goal-${Date.now()}`,
    title: '',
    hours: 10,
    deadline: '',
    status: 'active',
    createdAt: new Date().toISOString(),
    ...partial,
  };
  const updated = [...goals, goal];
  saveGoals(updated);
  return { goals: updated, goal };
}

export function updateGoal(goals: Goal[], goalId: string, patch: Partial<Goal>): Goal[] {
  const updated = goals.map((g) => (g.id === goalId ? { ...g, ...patch } : g));
  saveGoals(updated);
  return updated;
}

/** Ends a goal (default: abandoned) — frees a slot for a new goal.
 *  The roadmap/revision data under this goal's id is left untouched. */
export function endGoal(goals: Goal[], goalId: string, outcome: GoalStatus = 'abandoned'): Goal[] {
  return updateGoal(goals, goalId, { status: outcome, endedAt: new Date().toISOString() });
}