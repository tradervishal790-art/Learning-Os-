import type { RevisionItem, RevisionStatus, RevisionDifficulty, Topic, Difficulty, Goal } from './types';
import { getRoadmapData } from './roadmapData';
import { getReviewedDays } from './revisionstore';

// Standard spaced-repetition checkpoints, referenced across the app copy
// (App.tsx demo modal) as "Day 1, 3, 7, 15, 30, 60".
const SCHEDULE_DAYS = [1, 3, 7, 15, 30, 60];

function daysBetween(fromISO: string, to: Date = new Date()): number {
  const from = new Date(fromISO).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.floor((to.getTime() - from) / (1000 * 60 * 60 * 24));
}

function formatDueDate(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'Today';
  if (daysUntilDue === 1) return 'Tomorrow';
  if (daysUntilDue === -1) return 'Yesterday';
  if (daysUntilDue > 1) return `In ${daysUntilDue} days`;
  return `${Math.abs(daysUntilDue)} days ago`;
}

// Rough Ebbinghaus-style estimate — retention starts high right after the
// topic was last touched and decays the longer a due checkpoint is left
// unreviewed, relative to how long that checkpoint's interval is.
function estimateRetention(daysPastDue: number, intervalDays: number): number {
  const ratio = intervalDays > 0 ? daysPastDue / intervalDays : 0;
  const retention = 95 - Math.round(ratio * 40);
  return Math.max(30, Math.min(98, retention));
}

function categoryForDifficulty(difficulty: Difficulty): string {
  if (difficulty === 'Beginner') return 'Foundations';
  if (difficulty === 'Intermediate') return 'Core Concepts';
  return 'Advanced';
}

function toRevisionDifficulty(difficulty: Difficulty): RevisionDifficulty {
  if (difficulty === 'Beginner') return 'Easy';
  if (difficulty === 'Intermediate') return 'Medium';
  return 'Hard';
}

/**
 * Builds live spaced-repetition items straight from the roadmap — one item
 * per next-due schedule checkpoint, only for topics the learner has
 * actually started (status learning/completed/mastered AND has a
 * learningStartedAt timestamp). Nothing here is seeded/mock: an empty
 * roadmap or a roadmap nobody has started yet correctly returns [].
 */
export function getRevisionData(roadmap: Topic = getRoadmapData()): RevisionItem[] {
  const topics = roadmap.children ?? [];
  const items: RevisionItem[] = [];
  const now = new Date();

  for (const topic of topics) {
    if (topic.status === 'locked' || !topic.learningStartedAt) continue;

    const elapsedDays = daysBetween(topic.learningStartedAt, now);
    const reviewedDays = getReviewedDays(topic.id);
    const allCheckpointsDone = SCHEDULE_DAYS.every((d) => reviewedDays.includes(d));

    if (topic.status === 'mastered' || allCheckpointsDone) {
      items.push({
        id: `${topic.id}-mastered`,
        topicId: topic.id,
        topic: topic.title,
        category: categoryForDifficulty(topic.difficulty),
        day: SCHEDULE_DAYS[SCHEDULE_DAYS.length - 1],
        dueDate: 'Completed',
        status: 'mastered',
        difficulty: toRevisionDifficulty(topic.difficulty),
        retention: 100,
      });
      continue;
    }

    const nextDay = SCHEDULE_DAYS.find((d) => !reviewedDays.includes(d));
    if (nextDay === undefined) continue;

    const daysUntilDue = nextDay - elapsedDays;
    let status: RevisionStatus;
    if (daysUntilDue > 0) status = 'upcoming';
    else if (daysUntilDue === 0) status = 'due-today';
    else status = 'overdue';

    const retention = estimateRetention(Math.max(0, -daysUntilDue), nextDay);

    items.push({
      id: `${topic.id}-day${nextDay}`,
      topicId: topic.id,
      topic: topic.title,
      category: categoryForDifficulty(topic.difficulty),
      day: nextDay,
      dueDate: formatDueDate(daysUntilDue),
      status,
      difficulty: toRevisionDifficulty(topic.difficulty),
      retention,
    });
  }

  const statusOrder: Record<RevisionStatus, number> = { overdue: 0, 'due-today': 1, upcoming: 2, mastered: 3 };
  return items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.day - b.day);
}

/**
 * Same as getRevisionData, but merges checkpoints from EVERY active goal's
 * roadmap at once (each active goal has its own roadmap — see
 * roadmapData.ts). Items get a `goalTitle` tag when there's more than 1
 * active goal, so the UI can show which goal a checkpoint belongs to;
 * single-goal users see no change. Used by Dashboard's stats card and the
 * Revision page, so revision always covers both simultaneous goals instead
 * of just whichever one the Roadmap tab happens to be open on.
 */
export function getRevisionDataForGoals(goals: Goal[]): (RevisionItem & { goalTitle?: string })[] {
  const activeGoals = goals.filter((g) => g.status === 'active');
  if (activeGoals.length === 0) return getRevisionData();

  const merged = activeGoals.flatMap((g) => {
    const items = getRevisionData(getRoadmapData(g.id));
    return activeGoals.length > 1 ? items.map((it) => ({ ...it, goalTitle: g.title })) : items;
  });

  const statusOrder: Record<RevisionStatus, number> = { overdue: 0, 'due-today': 1, upcoming: 2, mastered: 3 };
  return merged.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.day - b.day);
}

/** Aggregate stats for the Revision dashboard — counts + average retention. */
export function getRevisionStats(items: RevisionItem[]) {
  const total = items.length;
  const dueToday = items.filter((i) => i.status === 'due-today').length;
  const overdue = items.filter((i) => i.status === 'overdue').length;
  const upcoming = items.filter((i) => i.status === 'upcoming').length;
  const mastered = items.filter((i) => i.status === 'mastered').length;
  const avgRetention =
    total === 0 ? 0 : Math.round(items.reduce((sum, i) => sum + i.retention, 0) / total);

  return { total, dueToday, overdue, upcoming, mastered, avgRetention };
}