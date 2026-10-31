import type { RevisionItem, RevisionStatus, RevisionDifficulty, Topic, Difficulty, Goal } from './types';
import { getRoadmapData } from './roadmapData';
import { getReviewedDays, getReviewDate } from './revisionstore';
import type { TranslationShape } from './i18n/translations';

// Day labels remain stable, while each next interval is measured from the
// actual completion time of the previous checkpoint.
const SCHEDULE_DAYS = [1, 3, 7, 15, 30, 60];

function daysBetween(fromISO: string, to: Date = new Date()): number {
  const from = new Date(fromISO).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.floor((to.getTime() - from) / (1000 * 60 * 60 * 24));
}

function addDays(dateISO: string, days: number): string {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return dateISO;
  date.setDate(date.getDate() + days);
  return date.toISOString();
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
// unreviewed, relative to the interval length.
function estimateRetention(daysPastDue: number, intervalDays: number): number {
  const ratio = intervalDays > 0 ? daysPastDue / intervalDays : 0;
  const retention = 95 - Math.round(ratio * 40);
  return Math.max(30, Math.min(98, retention));
}

function fallbackDayTasks(revisionTasks: TranslationShape['revisionTasks']): Record<number, string> {
  return {
    1: revisionTasks.day1,
    3: revisionTasks.day3,
    7: revisionTasks.day7,
    15: revisionTasks.day15,
    30: revisionTasks.day30,
    60: revisionTasks.day60,
  };
}

function getTaskForTopic(topicTitle: string, day: number, revisionTasks: TranslationShape['revisionTasks']): string {
  try {
    const cacheKey = `deepnotes_v3_topic_${topicTitle.trim().toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const notes = JSON.parse(cached) as { learningPath?: string[] };
      const match = notes.learningPath?.find((line) => line.trim().toLowerCase().startsWith(`day ${day}:`));
      if (match) {
        const colonIndex = match.indexOf(':');
        return colonIndex >= 0 ? match.slice(colonIndex + 1).trim() : match.trim();
      }
    }
  } catch {
    // Corrupted/unavailable cache — fall through to generic task.
  }
  return fallbackDayTasks(revisionTasks)[day] ?? revisionTasks.fallback;
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
 * Builds live spaced-repetition items from started roadmap topics. New
 * reviews schedule the next checkpoint relative to the actual last review.
 * Old installations without timestamps retain their original due dates.
 */
export function getRevisionData(revisionTasks: TranslationShape['revisionTasks'], roadmap: Topic = getRoadmapData()): RevisionItem[] {
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
        task: 'Mastered — sab checkpoints ho gaye ✓',
      });
      continue;
    }

    const nextDay = SCHEDULE_DAYS.find((d) => !reviewedDays.includes(d));
    if (nextDay === undefined) continue;

    const previousDay = [...reviewedDays].filter((day) => SCHEDULE_DAYS.includes(day) && day < nextDay).sort((a, b) => b - a)[0] ?? 0;
    const previousReviewDate = previousDay ? getReviewDate(topic.id, previousDay) : null;

    // For legacy records without a timestamp, reconstruct the old planned
    // checkpoint date so existing learners do not suddenly lose or gain time.
    const anchorDate = previousReviewDate
      ?? (previousDay ? addDays(topic.learningStartedAt, previousDay) : topic.learningStartedAt);
    const intervalDays = nextDay - previousDay;
    const elapsedSinceAnchor = previousReviewDate
      ? daysBetween(anchorDate, now)
      : previousDay
        ? daysBetween(anchorDate, now)
        : elapsedDays;
    const daysUntilDue = intervalDays - elapsedSinceAnchor;

    let status: RevisionStatus;
    if (daysUntilDue > 0) status = 'upcoming';
    else if (daysUntilDue === 0) status = 'due-today';
    else status = 'overdue';

    const retention = estimateRetention(Math.max(0, -daysUntilDue), intervalDays);

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
      task: getTaskForTopic(topic.title, nextDay, revisionTasks),
    });
  }

  const statusOrder: Record<RevisionStatus, number> = { overdue: 0, 'due-today': 1, upcoming: 2, mastered: 3 };
  return items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.day - b.day);
}

/** Merge checkpoints from every active goal's roadmap at once. */
export function getRevisionDataForGoals(
  revisionTasks: TranslationShape['revisionTasks'],
  goals: Goal[]
): (RevisionItem & { goalTitle?: string; goalId?: string })[] {
  const activeGoals = goals.filter((g) => g.status === 'active');
  if (activeGoals.length === 0) return getRevisionData(revisionTasks);

  const merged = activeGoals.flatMap((g) => {
    const items = getRevisionData(revisionTasks, getRoadmapData(g.id));
    return items.map((it) => ({ ...it, goalId: g.id, ...(activeGoals.length > 1 ? { goalTitle: g.title } : {}) }));
  });

  const statusOrder: Record<RevisionStatus, number> = { overdue: 0, 'due-today': 1, upcoming: 2, mastered: 3 };
  return merged.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.day - b.day);
}

/** Aggregate counts for the Revision dashboard. */
export function getRevisionStats(items: RevisionItem[]) {
  const total = items.length;
  const dueToday = items.filter((i) => i.status === 'due-today').length;
  const overdue = items.filter((i) => i.status === 'overdue').length;
  const upcoming = items.filter((i) => i.status === 'upcoming').length;
  const mastered = items.filter((i) => i.status === 'mastered').length;
  const avgRetention = total === 0 ? 0 : Math.round(items.reduce((sum, i) => sum + i.retention, 0) / total);
  return { total, dueToday, overdue, upcoming, mastered, avgRetention };
}
