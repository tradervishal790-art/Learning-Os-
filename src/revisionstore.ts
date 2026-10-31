import { pushToCloud, pullFromCloud } from './cloudSync';

// Checkpoints stay in the legacy day map for compatibility. Actual review
// timestamps live beside it so the next interval starts when the learner
// really reviewed, not when they first opened the topic.
const REVISION_REVIEWS_STORAGE_KEY = 'learning_os_revision_reviews';
const REVISION_DATES_STORAGE_KEY = 'learning_os_revision_review_dates';
const CLOUD_KEY = 'revisionReviews';
const CLOUD_DATES_KEY = 'revisionReviewDates';

type ReviewsMap = Record<string, number[]>;
type ReviewDatesMap = Record<string, Record<string, string>>;

function loadReviews(): ReviewsMap {
  try {
    const saved = localStorage.getItem(REVISION_REVIEWS_STORAGE_KEY);
    if (!saved) return {};
    const parsed: unknown = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ReviewsMap : {};
  } catch {
    return {};
  }
}

function loadReviewDates(): ReviewDatesMap {
  try {
    const saved = localStorage.getItem(REVISION_DATES_STORAGE_KEY);
    if (!saved) return {};
    const parsed: unknown = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ReviewDatesMap : {};
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

function saveReviewDates(dates: ReviewDatesMap): void {
  try {
    localStorage.setItem(REVISION_DATES_STORAGE_KEY, JSON.stringify(dates));
  } catch {
    // Keep the revision flow usable when browser storage is unavailable.
  }
  void pushToCloud(CLOUD_DATES_KEY, dates);
}

/** Merge local + cloud checkpoints without losing reviews recorded on either device. */
export function mergeReviewMaps(local: ReviewsMap, cloud: ReviewsMap): ReviewsMap {
  const merged: ReviewsMap = {};
  for (const source of [cloud, local]) {
    for (const [topicId, days] of Object.entries(source)) {
      if (!topicId.trim() || !Array.isArray(days)) continue;
      const validDays = days.filter((day): day is number =>
        typeof day === 'number' && Number.isInteger(day) && day > 0
      );
      merged[topicId] = [...new Set([...(merged[topicId] ?? []), ...validDays])].sort((a, b) => a - b);
    }
  }
  return merged;
}

export function mergeReviewDateMaps(local: ReviewDatesMap, cloud: ReviewDatesMap): ReviewDatesMap {
  const merged: ReviewDatesMap = {};
  for (const source of [cloud, local]) {
    for (const [topicId, dates] of Object.entries(source)) {
      if (!topicId.trim() || !dates || typeof dates !== 'object' || Array.isArray(dates)) continue;
      for (const [day, timestamp] of Object.entries(dates)) {
        if (!/^\d+$/.test(day) || !Number.isFinite(Date.parse(timestamp))) continue;
        const previous = merged[topicId]?.[day];
        if (!previous || Date.parse(timestamp) > Date.parse(previous)) {
          merged[topicId] ??= {};
          merged[topicId][day] = timestamp;
        }
      }
    }
  }
  return merged;
}

/**
 * Pull revision history on demand and merge it with local data. Timestamp
 * history is additive and separate so older installations keep their
 * original checkpoint data without a destructive migration.
 */
export async function hydrateRevisionFromCloud(): Promise<void> {
  const [cloud, cloudDates] = await Promise.all([
    pullFromCloud<ReviewsMap>(CLOUD_KEY),
    pullFromCloud<ReviewDatesMap>(CLOUD_DATES_KEY),
  ]);
  // Re-read after the network wait: a review may have been recorded locally
  // while cloud hydration was in flight. Never merge from a stale snapshot.
  const latestLocal = loadReviews();
  const latestLocalDates = loadReviewDates();
  if (cloud) {
    const merged = mergeReviewMaps(latestLocal, cloud);
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      try {
        localStorage.setItem(REVISION_REVIEWS_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Best-effort.
      }
      void pushToCloud(CLOUD_KEY, merged);
    }
  }
  if (cloudDates) {
    const mergedDates = mergeReviewDateMaps(latestLocalDates, cloudDates);
    if (JSON.stringify(mergedDates) !== JSON.stringify(localDates)) saveReviewDates(mergedDates);
  }
}

/** Which schedule-day checkpoints have been marked done for this topic. */
export function getReviewedDays(topicId: string): number[] {
  const days = loadReviews()[topicId];
  return Array.isArray(days) ? days.filter((day) => Number.isInteger(day) && day > 0) : [];
}

/** Actual completion time for a checkpoint; null means legacy history. */
export function getReviewDate(topicId: string, day: number): string | null {
  const value = loadReviewDates()[topicId]?.[String(day)];
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

/** Marks a checkpoint as reviewed — idempotent and timestamped. */
export function markDayReviewed(topicId: string, day: number, reviewedAt = new Date().toISOString()): void {
  if (!topicId.trim() || !Number.isInteger(day) || day <= 0 || !Number.isFinite(Date.parse(reviewedAt))) return;
  const reviews = loadReviews();
  const existing = reviews[topicId] ?? [];
  if (!existing.includes(day)) {
    reviews[topicId] = [...existing, day].sort((a, b) => a - b);
    saveReviews(reviews);
  }

  const dates = loadReviewDates();
  dates[topicId] ??= {};
  dates[topicId][String(day)] = reviewedAt;
  saveReviewDates(dates);
}

/** Undo a checkpoint, including its timestamp, if it was clicked by mistake. */
export function unmarkDayReviewed(topicId: string, day: number): void {
  const reviews = loadReviews();
  const existing = reviews[topicId] ?? [];
  reviews[topicId] = existing.filter((d) => d !== day);
  saveReviews(reviews);

  const dates = loadReviewDates();
  if (dates[topicId]) {
    delete dates[topicId][String(day)];
    if (Object.keys(dates[topicId]).length === 0) delete dates[topicId];
    saveReviewDates(dates);
  }
}
