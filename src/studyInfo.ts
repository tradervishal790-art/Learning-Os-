import type { StudyStatus } from './notebookStore';

// Pure helpers for the study details of a note (status, confidence, exam date).

export const STUDY_STATUSES: StudyStatus[] = ['not-started', 'learning', 'needs-revision', 'mastered'];

/** A local calendar date 'YYYY-MM-DD' as a Date at local midnight (null when it is not a real date). */
export function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // reject 2026-02-31 style dates (JS would roll them over to March)
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

export const toLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Whole days from today to the date (0 = today, negative = past). null for a missing / invalid date. */
export function daysUntil(date: string | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = parseLocalDate(date);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type ExamChip = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'future'; days: number } | { kind: 'past'; days: number };

/** What to show on a note card. Exams more than 3 days past are not shown any more. */
export function examChip(date: string | undefined, now: Date = new Date()): ExamChip | null {
  const d = daysUntil(date, now);
  if (d === null) return null;
  if (d === 0) return { kind: 'today' };
  if (d === 1) return { kind: 'tomorrow' };
  if (d > 1) return { kind: 'future', days: d };
  return d >= -3 ? { kind: 'past', days: -d } : null;
}

/** Exam within the next `withinDays` days (today counts). */
export function examSoon(date: string | undefined, withinDays = 14, now: Date = new Date()): boolean {
  const d = daysUntil(date, now);
  return d !== null && d >= 0 && d <= withinDays;
}

/** Sort key: soonest upcoming exam first, past / no date last. */
export function examSortKey(date: string | undefined, now: Date = new Date()): number {
  const d = daysUntil(date, now);
  return d === null || d < 0 ? Number.MAX_SAFE_INTEGER : d;
}
