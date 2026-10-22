// revisionSchedule.ts
//
// Pure rules for WHEN each spaced-repetition checkpoint is due (no storage, no React).
//
//  - The clock starts the day the class was finished (Topic.learningStartedAt is stamped then).
//  - Days are CALENDAR days in the learner's local time: "day 1" = tomorrow, not "24 hours later".
//  - Late reviews do not pile up: after a review, the next checkpoint is at least as far away as the
//    gap the schedule gives it (day 3 -> day 7 = 4 days, ...), counted from the day the learner
//    actually reviewed. So reviewing day 1 on day 6 makes day 3 due on day 8, not "today".

export const SCHEDULE_DAYS = [1, 3, 7, 15, 30, 60];

/** Whole local calendar days since 1970-01-01 (DST-safe: built from y/m/d, not from 24h blocks). */
export function localDayNumber(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return NaN;
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export interface NextCheckpoint {
  /** The schedule day being asked for (1, 3, 7, ...). */
  day: number;
  /** Calendar days from today until it is due: > 0 upcoming, 0 today, < 0 overdue. */
  daysUntilDue: number;
}

/**
 * The next checkpoint the learner has not reviewed yet, or null when every checkpoint is done
 * (or the start date is unusable).
 */
export function nextCheckpoint(input: {
  startedAt: string;
  reviewedDays: number[];
  /** ISO time of the most recent review of this topic, when known. */
  lastReviewedAt?: string | null;
  now?: Date;
}): NextCheckpoint | null {
  const { startedAt, reviewedDays, lastReviewedAt } = input;
  const today = localDayNumber(input.now ?? new Date());
  const start = localDayNumber(startedAt);
  if (Number.isNaN(start) || Number.isNaN(today)) return null;

  const index = SCHEDULE_DAYS.findIndex((d) => !reviewedDays.includes(d));
  if (index === -1) return null;
  const day = SCHEDULE_DAYS[index];

  let due = start + day;
  if (index > 0 && lastReviewedAt) {
    const last = localDayNumber(lastReviewedAt);
    if (!Number.isNaN(last)) due = Math.max(due, last + (day - SCHEDULE_DAYS[index - 1]));
  }
  return { day, daysUntilDue: due - today };
}
