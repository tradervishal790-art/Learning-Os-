// ============================================================
// revisionStore.ts
// Tracks which spaced-repetition checkpoints (Day 1/3/7/15/30/60) the
// learner has actually marked "done" for each roadmap topic. Separate
// from roadmapData.ts because a topic can have multiple review
// checkpoints over its lifetime — this is a per-checkpoint log, not a
// single status field.
// ============================================================

const REVISION_REVIEWS_STORAGE_KEY = 'learning_os_revision_reviews';

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
  }
}

/** Undo, in case "Mark Done" was clicked by mistake. */
export function unmarkDayReviewed(topicId: string, day: number): void {
  const reviews = loadReviews();
  const existing = reviews[topicId] ?? [];
  reviews[topicId] = existing.filter((d) => d !== day);
  saveReviews(reviews);
}