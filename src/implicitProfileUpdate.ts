import type { EngagementSession, LearningProfile } from './types';
import type { TeachingDimensions } from './PlaylistBuilder';
import { dimensionsFromLearningProfile } from './PlaylistBuilder';
import { getEngagementSessions } from './engagementStore';
import { getCachedVideoDimensions } from './conceptVideoPool';
import { saveLearningProfile } from './learningProfileStore';

// ============================================================
// implicitProfileUpdate.ts
//
// Updates the LearningProfile from what the student actually WATCHES,
// not just what they answered in a quiz/interview. This is a *second*,
// independent update path alongside mergeLearningProfile() (deep-dive
// chat) — both blend into the same profile, neither overwrites it.
//
// Design (see /areas/learning-os.md decisions):
// - Rolling window, not lifetime count: only the last ROLLING_WINDOW
//   sessions are considered, so an old phase of the user's taste can't
//   permanently anchor the profile, and a real shift in taste is picked
//   up within a handful of videos.
// - Only POSITIVE, CONFIRMED signals count as "this teaching style
//   worked for them" — a click alone is not enough. We require either
//   explicit positive feedback or a real watch-through (>=70%) /
//   replay, matching computeEngagementSignal()'s own 'like' bar.
// - Requires MIN_CONSISTENT agreeing signals in the window before
//   touching the profile at all — one good video is noise, not signal.
// - Blends with a SMALL weight (IMPLICIT_BLEND_WEIGHT) — smaller than
//   the deep-dive chat's 0.35 — because behavioral inference is noisier
//   than a direct, considered answer. The profile should drift, not jump.
// ============================================================

const ROLLING_WINDOW = 5;
const MIN_CONSISTENT = 3;
const IMPLICIT_BLEND_WEIGHT = 0.15;

type DimensionField = keyof TeachingDimensions;
type ProfileField = keyof Pick<
  LearningProfile,
  'pace' | 'theoryVsPractical' | 'structureNeed' | 'depth' | 'languageComplexity' | 'storytelling' | 'repetitionNeed' | 'priorKnowledgeComfort'
>;

// Same pairing PlaylistBuilder.ts uses between the quiz's camelCase
// dimensions and Gemini's snake_case video dimensions.
const FIELD_MAP: [ProfileField, DimensionField][] = [
  ['pace', 'pace'],
  ['theoryVsPractical', 'theory_vs_practical'],
  ['structureNeed', 'structure'],
  ['depth', 'depth'],
  ['languageComplexity', 'language_complexity'],
  ['storytelling', 'storytelling'],
  ['repetitionNeed', 'repetition'],
  ['priorKnowledgeComfort', 'prerequisite_assumed'],
];

/** A session counts as a confirmed positive signal for the video's teaching style. */
function isPositiveSignal(session: EngagementSession): boolean {
  if (session.feedback === 'like') return true;
  if (session.feedback === 'dislike') return false;
  return session.completed && (session.watchPercentage >= 70 || session.replayCount > 0);
}

/**
 * Checks the last ROLLING_WINDOW engagement sessions. If at least
 * MIN_CONSISTENT of them are positive signals AND their video dimensions
 * agree with each other (not scattered noise), blends their average into
 * the current profile and persists it. Otherwise leaves the profile
 * untouched and returns it unchanged.
 *
 * Call this after every completed video (same trigger point as
 * PlaylistBuilder.rerankRemaining) — cheap, pure localStorage reads.
 */
export function maybeUpdateProfileFromEngagement(currentProfile: LearningProfile): LearningProfile {
  const recentWindow = getEngagementSessions().slice(-ROLLING_WINDOW);

  const positiveDimensions: TeachingDimensions[] = recentWindow
    .filter(isPositiveSignal)
    .map((s) => getCachedVideoDimensions(s.videoId))
    .filter((d): d is TeachingDimensions => d !== null);

  if (positiveDimensions.length < MIN_CONSISTENT) return currentProfile;

  // Consistency check: average pairwise spread per dimension shouldn't be
  // wildly scattered — if the user is liking videos all over the map,
  // that's not a stable pattern worth updating on yet.
  const avgSpread =
    FIELD_MAP.reduce((sum, [, dimKey]) => {
      const values = positiveDimensions.map((d) => d[dimKey]);
      const spread = Math.max(...values) - Math.min(...values);
      return sum + spread;
    }, 0) / FIELD_MAP.length;

  const MAX_ACCEPTABLE_SPREAD = 4; // on the 1-10 scale
  if (avgSpread > MAX_ACCEPTABLE_SPREAD) return currentProfile;

  const signalAverage: Record<DimensionField, number> = {} as Record<DimensionField, number>;
  FIELD_MAP.forEach(([, dimKey]) => {
    const values = positiveDimensions.map((d) => d[dimKey]);
    signalAverage[dimKey] = values.reduce((a, b) => a + b, 0) / values.length;
  });

  const updated: LearningProfile = { ...currentProfile };
  FIELD_MAP.forEach(([profileKey, dimKey]) => {
    const oldVal = currentProfile[profileKey];
    const signalVal = signalAverage[dimKey];
    updated[profileKey] = Math.round(oldVal * (1 - IMPLICIT_BLEND_WEIGHT) + signalVal * IMPLICIT_BLEND_WEIGHT);
  });

  saveLearningProfile(updated);
  return updated;
}

/** Exposed for debugging/Settings — shows what the rolling window currently looks like. */
export function getRollingWindowSummary(): {
  windowSize: number;
  positiveCount: number;
  willUpdateNextTime: boolean;
} {
  const recentWindow = getEngagementSessions().slice(-ROLLING_WINDOW);
  const positiveCount = recentWindow.filter(isPositiveSignal).length;
  return {
    windowSize: recentWindow.length,
    positiveCount,
    willUpdateNextTime: positiveCount >= MIN_CONSISTENT,
  };
}

// Re-exported so callers don't need to know PlaylistBuilder is involved too.
export { dimensionsFromLearningProfile };
