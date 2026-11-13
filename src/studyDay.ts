import { calculateCurrentStreak, localDayKey, normalizeActiveDays } from './progressMetrics';

// ============================================================
// studyDay.ts — the ONE place that decides what counts as a "study day".
//
// A day is marked only when the learner actually studies: a revision check-in,
// a finished topic, a submitted test, a logged study session, or a watched
// video (>= MIN_WATCH_SECONDS). Merely opening the app does NOT count, so the
// streak and heatmap reward learning, not launching the app.
//
// Same storage key / UTC day-key format as before, so existing history and
// the Progress screen keep working. Cloud sync is done by Dashboard when it
// hears STUDY_DAY_EVENT (this file stays free of Firebase on purpose).
// ============================================================

export const ACTIVE_DAYS_STORAGE_KEY = 'learning_os_active_days';
export const STUDY_DAY_EVENT = 'learning-os-study-day';
/** A video session shorter than this is a glance, not studying. */
export const MIN_WATCH_SECONDS = 60;

const utcDayKey = localDayKey; // the learner's own calendar day, not UTC

export function readStudyDays(): string[] {
  try {
    return normalizeActiveDays(JSON.parse(localStorage.getItem(ACTIVE_DAYS_STORAGE_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

/** Current streak. Stays alive through yesterday until the learner studies today. */
export function readStudyStreak(now = new Date()): number {
  return calculateCurrentStreak(readStudyDays(), now);
}

/** Marks today as a study day. Idempotent; announces only when a NEW day is added. */
export function markStudyDay(now = new Date()): void {
  const today = utcDayKey(now);
  const days = readStudyDays();
  if (days.includes(today)) return;
  days.push(today);
  try {
    localStorage.setItem(ACTIVE_DAYS_STORAGE_KEY, JSON.stringify(days));
  } catch {
    return;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(STUDY_DAY_EVENT));
}

/** True when a note holds something the learner wrote or drew — an empty page is not study. */
export function hasWrittenContent(pages: readonly { text: string; ink?: readonly unknown[]; hasInk?: boolean }[]): boolean {
  return pages.some((page) => page.text.trim().length > 0 || (page.ink?.length ?? 0) > 0 || page.hasInk === true);
}
