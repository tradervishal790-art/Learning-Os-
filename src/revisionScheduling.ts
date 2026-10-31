export type RecallSignal = 'forgot' | 'partial' | 'remembered';

/**
 * Turn recent self-reported recall into the next interval.
 * Forgetting triggers a short relearn loop; partial recall consolidates sooner;
 * repeated strong recall earns a modest extension without skipping checkpoints.
 */
export function getAdaptiveIntervalDays(
  standardIntervalDays: number,
  recentRatings: readonly RecallSignal[],
): number {
  const standard = Number.isFinite(standardIntervalDays)
    ? Math.max(1, Math.floor(standardIntervalDays))
    : 1;
  const latest = recentRatings[recentRatings.length - 1];

  if (latest === 'forgot') return 1;
  if (latest === 'partial') return Math.max(1, Math.ceil(standard / 2));
  if (latest !== 'remembered') return standard;

  let rememberedStreak = 0;
  for (let index = recentRatings.length - 1; index >= 0; index -= 1) {
    if (recentRatings[index] !== 'remembered') break;
    rememberedStreak += 1;
  }

  return rememberedStreak >= 2
    ? Math.min(standard + 2, Math.ceil(standard * 1.25))
    : standard;
}

/** Count local calendar boundaries, not elapsed 24-hour blocks (DST-safe). */
export function calendarDaysBetween(fromISO: string, to: Date = new Date()): number {
  const from = new Date(fromISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toDay - fromDay) / 86_400_000);
}

/** Missed checkpoints remain one active task per topic; never create a catch-up pile. */
export function getDaysOverdue(daysUntilDue: number): number {
  return Number.isFinite(daysUntilDue) ? Math.max(0, Math.ceil(-daysUntilDue)) : 0;
}
