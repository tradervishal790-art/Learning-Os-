import type { EngagementSession } from './types';

export type SharedLearningOutcome = 'early-drop' | 'partial' | 'near-complete' | 'completed';
export type SharedLearningFeedback = 'like' | 'dislike' | 'none';

export interface SharedLearningCounters {
  sampleCount: number;
  earlyDropCount: number;
  partialCount: number;
  nearCompleteCount: number;
  completedCount: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
}

export interface SharedLearningSessionInput {
  totalDuration: number;
  watchedSeconds: number;
  watchPercentage: number;
  completed: boolean;
  feedback: SharedLearningFeedback;
}

/** Ignore accidental starts and tiny samples; they are not useful learning evidence. */
export function isMeaningfulSharedLearningSample(session: SharedLearningSessionInput): boolean {
  return (
    Number.isFinite(session.totalDuration) &&
    Number.isFinite(session.watchedSeconds) &&
    Number.isFinite(session.watchPercentage) &&
    session.totalDuration > 0 &&
    session.watchedSeconds >= 30 &&
    session.watchPercentage >= 5 &&
    session.watchPercentage <= 100
  );
}

/** Coarse buckets only: no exact watch timeline, pause history, or learner profile is shared. */
export function classifySharedLearningOutcome(
  session: Pick<SharedLearningSessionInput, 'watchPercentage' | 'completed'>
): SharedLearningOutcome {
  if (session.completed || session.watchPercentage >= 85) return 'completed';
  if (session.watchPercentage >= 70) return 'near-complete';
  if (session.watchPercentage >= 20) return 'partial';
  return 'early-drop';
}

export function buildSharedLearningCounters(
  outcome: SharedLearningOutcome,
  feedback: SharedLearningFeedback
): SharedLearningCounters {
  return {
    sampleCount: 1,
    earlyDropCount: outcome === 'early-drop' ? 1 : 0,
    partialCount: outcome === 'partial' ? 1 : 0,
    nearCompleteCount: outcome === 'near-complete' ? 1 : 0,
    completedCount: outcome === 'completed' ? 1 : 0,
    positiveFeedbackCount: feedback === 'like' ? 1 : 0,
    negativeFeedbackCount: feedback === 'dislike' ? 1 : 0,
  };
}

/** Converts an existing private engagement session into a minimal shareable sample. */
export function toSharedLearningSample(session: EngagementSession): {
  outcome: SharedLearningOutcome;
  feedback: SharedLearningFeedback;
} | null {
  if (!isMeaningfulSharedLearningSample(session)) return null;
  return {
    outcome: classifySharedLearningOutcome(session),
    feedback: session.feedback ?? 'none',
  };
}
