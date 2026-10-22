import { pushToCloud, pullFromCloud } from './cloudSync';

// ============================================================
// revisionStore.ts
// Tracks which spaced-repetition checkpoints (Day 1/3/7/15/30/60) the
// learner has actually marked "done" for each roadmap topic. Separate
// from roadmapData.ts because a topic can have multiple review
// checkpoints over its lifetime — this is a per-checkpoint log, not a
// single status field.
//
// CROSS-DEVICE SYNC: same pattern as learningProfileStore.ts — localStorage
// stays the synchronous source of truth, saves also push to Firestore
// (best-effort, fire-and-forget), and hydrateRevisionFromCloud() — called
// once on sign-in — pulls the cloud copy down if this device has none yet.
// ============================================================

const REVISION_REVIEWS_STORAGE_KEY = 'learning_os_revision_reviews';
const CLOUD_KEY = 'revisionReviews';
// topicId -> ISO time of the most recent review. Lets the schedule push a late learner's next
// checkpoint forward instead of showing several overdue ones one after another.
const REVIEW_DATES_STORAGE_KEY = 'learning_os_revision_review_dates';
const DATES_CLOUD_KEY = 'revisionReviewDates';

type ReviewsMap = Record<string, number[]>; // topicId -> reviewed schedule days

function loadReviews(): ReviewsMap {
  try {
    const saved = localStorage.getItem(REVISION_REVIEWS_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveReviews(reviews: ReviewsMap): void {
  try {
    localStorage.setItem(REVISION_REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    // Storage full/unavailable — non-critical, review state just won't persist.
  }
  void pushToCloud(CLOUD_KEY, reviews);
}

type DatesMap = Record<string, string>;

function loadDates(): DatesMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEW_DATES_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveDates(dates: DatesMap): void {
  try {
    localStorage.setItem(REVIEW_DATES_STORAGE_KEY, JSON.stringify(dates));
  } catch {
    // non-critical
  }
  void pushToCloud(DATES_CLOUD_KEY, dates);
}

/** ISO time this topic was last marked reviewed, or null (never, or reviewed before dates were kept). */
export function getLastReviewedAt(topicId: string): string | null {
  return loadDates()[topicId] ?? null;
}

/**
 * Called once, the first time the Revision page is opened (see
 * Revision.tsx) — not upfront on sign-in — to pull revision history down
 * from Firestore into localStorage on a device that has none yet — without
 * this, a topic marked "revised" on Device A would show as never-revised
 * on Device B, wrongly re-triggering "overdue" reminders there.
 */
export async function hydrateRevisionFromCloud(): Promise<void> {
  if (Object.keys(loadDates()).length === 0) {
    const cloudDates = await pullFromCloud<DatesMap>(DATES_CLOUD_KEY);
    if (cloudDates && Object.keys(cloudDates).length > 0) {
      try {
        localStorage.setItem(REVIEW_DATES_STORAGE_KEY, JSON.stringify(cloudDates));
      } catch {
        // Best-effort.
      }
    }
  }
  if (Object.keys(loadReviews()).length > 0) return; // this device already has review history — don't clobber it
  const cloud = await pullFromCloud<ReviewsMap>(CLOUD_KEY);
  if (cloud && Object.keys(cloud).length > 0) {
    try {
      localStorage.setItem(REVISION_REVIEWS_STORAGE_KEY, JSON.stringify(cloud));
    } catch {
      // Best-effort.
    }
  }
}

/** Which schedule-day checkpoints (e.g. [1, 3]) have been marked done for this topic. */
export function getReviewedDays(topicId: string): number[] {
  return loadReviews()[topicId] ?? [];
}

/** Marks a checkpoint as reviewed — idempotent, safe to call more than once. */
export function markDayReviewed(topicId: string, day: number): void {
  const reviews = loadReviews();
  const existing = reviews[topicId] ?? [];
  if (!existing.includes(day)) {
    reviews[topicId] = [...existing, day].sort((a, b) => a - b);
    saveReviews(reviews);
    saveDates({ ...loadDates(), [topicId]: new Date().toISOString() });
  }
}

/** Undo, in case "Mark Done" was clicked by mistake. */
export function unmarkDayReviewed(topicId: string, day: number): void {
  const reviews = loadReviews();
  const existing = reviews[topicId] ?? [];
  reviews[topicId] = existing.filter((d) => d !== day);
  saveReviews(reviews);
  // The previous review date is not kept, so fall back to the plain schedule for this topic.
  const dates = loadDates();
  if (topicId in dates) {
    delete dates[topicId];
    saveDates(dates);
  }
}