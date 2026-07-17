import type { EngagementSession, EngagementSignal, FeedbackValue } from './types';

/**
 * Pure scoring function — no side effects, no imports beyond types.
 * Deliberately kept dependency-free so it can be copy-pasted into a
 * Firebase Cloud Function or any backend later without changes.
 */
export function computeEngagementSignal(session: {
  watchPercentage: number;
  replayCount: number;
  feedback: FeedbackValue;
}): EngagementSignal {
  let signal: EngagementSignal;

  if (session.watchPercentage < 20 && session.replayCount === 0) {
    signal = 'dislike';
  } else if (session.watchPercentage > 70 || session.replayCount > 0) {
    signal = 'like';
  } else {
    signal = 'neutral';
  }

  // Explicit feedback overrides the inferred signal — a user who clicks
  // "Not for me" means it regardless of how much they watched.
  if (session.feedback === 'dislike') {
    signal = 'strong_dislike';
  } else if (session.feedback === 'like') {
    signal = 'like';
  }

  return signal;
}

/** Convenience wrapper that fills in the `signal` field on a full session object. */
export function withComputedSignal(session: Omit<EngagementSession, 'signal'>): EngagementSession {
  return {
    ...session,
    signal: computeEngagementSignal(session),
  };
}