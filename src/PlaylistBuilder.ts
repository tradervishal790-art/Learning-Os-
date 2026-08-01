import { getEngagementSessions, getEngagementSessionsForVideo } from './engagementStore';
import type { EngagementSession, LearningProfile, Video } from './types';

// ============================================================
// PlaylistBuilder.ts
//
// Purpose: given a concept and a pool of pre-analyzed candidate videos,
// pick the single best video + 2 fallbacks, and rerank the remaining
// playlist after each completed video using updated learner data.
//
// This file does NOT track engagement and does NOT call any AI API.
// It only READS from engagementStore.ts (past sessions). It uses the
// real LearningProfile / EngagementSession types from types.ts.
//
// DEADLINE AWARENESS (new):
// If the user picked hours/week + a deadline for this topic, we convert
// that into a total-hours budget and use it to nudge the learner's
// effective "pace" preference upward when time is tight. A higher pace
// score makes dimensionMatchScore favor faster / denser videos, so the
// selected playlist is more likely to fit inside the deadline instead of
// picking slow, deep-dive content that would blow past it.
// ============================================================

// ---- Types ----

/**
 * Shape of the `profile` object returned by api/analyze-video.ts (Gemini output).
 * Field names are snake_case because that's what the Gemini prompt asks for —
 * mapped to camelCase LearningProfile via dimensionsFromLearningProfile() below.
 */
export interface TeachingDimensions {
  pace: number;
  theory_vs_practical: number;
  structure: number;
  depth: number;
  language_complexity: number;
  storytelling: number;
  repetition: number;
  prerequisite_assumed: number;
}

/** One pre-analyzed candidate video for a given concept (cached output of analyze-video.ts) */
export interface AnalyzedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string; // display name, e.g. YouTube channel title
  teacherId: string; // channelId — unique identity
  conceptId: string;
  dimensions: TeachingDimensions;
  primaryStyle?: string;
  idealFor?: string;
  avoidFor?: string;
}

export interface PlaylistResult {
  primary: AnalyzedVideo;
  fallbacks: AnalyzedVideo[]; // next 2, in order
  teacherSwitched: boolean;
}

/**
 * User-chosen timing for a topic/custom playlist — hours/week they can commit
 * and a deadline bucket. Both come straight from the UI (Roadmap.tsx /
 * Dashboard.tsx custom playlist modal). `deadline` matches the `id` values of
 * the deadlineOptions used in those components: 'none' | '1m' | '3m' | '6m' | '1y'.
 */
export interface PlaylistTiming {
  hours: number;
  deadline: string;
}

// ---- Tunable weights ----
const WEIGHTS = {
  dimensionMatch: 0.5,
  teacherAffinity: 0.3,
  continuityBonus: 0.2,
};

// Don't switch teacher unless the alternative is meaningfully better —
// prevents flip-flopping between two close-scoring teachers every concept.
const SWITCH_THRESHOLD = 0.12; // on a 0-1 normalized score

// ---- Deadline handling ----

/** Approximate days for each deadline bucket used across the UI. */
const DEADLINE_DAYS: Record<string, number> = {
  none: Infinity,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

/**
 * Converts hours/week + deadline bucket into a total-hours budget.
 * Returns Infinity if there's no real constraint (no deadline chosen,
 * or no hours/week given) — meaning "no urgency, don't touch pace".
 */
function calculateAvailableHours(timing?: PlaylistTiming): number {
  if (!timing) return Infinity;
  const { hours, deadline } = timing;
  if (!hours || !deadline || deadline === 'none') return Infinity;
  const days = DEADLINE_DAYS[deadline];
  if (!days || days === Infinity) return Infinity;
  const weeks = days / 7;
  return weeks * hours;
}

/**
 * Bumps the learner's pace preference upward when the available-hours
 * budget is tight, so faster/denser videos score higher in dimensionMatchScore.
 * Thresholds are deliberately simple/tunable — not derived from real usage data yet.
 *   < 40 total hours available  -> big push toward fast pace (+3)
 *   < 100 total hours available -> moderate push (+1.5)
 *   otherwise                   -> no change, learner's own pace stands
 * Result is clamped to the 1-10 scale used everywhere else.
 */
function adjustPaceForUrgency(basePace: number, timing?: PlaylistTiming): number {
  const availableHours = calculateAvailableHours(timing);
  let boost = 0;
  if (availableHours < 40) boost = 3;
  else if (availableHours < 100) boost = 1.5;
  if (boost === 0) return basePace;
  return Math.min(10, Math.max(1, basePace + boost));
}

// ---- Mapping: real LearningProfile (camelCase, quiz-derived) -> TeachingDimensions (snake_case, Gemini-derived) ----
// Both scales are 1-10 and conceptually aligned pair-for-pair:
//   theoryVsPractical <-> theory_vs_practical
//   structureNeed     <-> structure
//   languageComplexity<-> language_complexity
//   repetitionNeed     <-> repetition
//   priorKnowledgeComfort <-> prerequisite_assumed  (both mean "how much prior knowledge is comfortable/assumed")
export function dimensionsFromLearningProfile(profile: LearningProfile): TeachingDimensions {
  return {
    pace: profile.pace,
    theory_vs_practical: profile.theoryVsPractical,
    structure: profile.structureNeed,
    depth: profile.depth,
    language_complexity: profile.languageComplexity,
    storytelling: profile.storytelling,
    repetition: profile.repetitionNeed,
    prerequisite_assumed: profile.priorKnowledgeComfort,
  };
}

// ---- Core scoring ----

/** 0-1 score: how closely a video's teaching style matches the learner's preferred dimensions. */
function dimensionMatchScore(video: TeachingDimensions, learner: TeachingDimensions): number {
  const keys = Object.keys(video) as (keyof TeachingDimensions)[];
  const totalDiff = keys.reduce((sum, k) => sum + Math.abs(video[k] - learner[k]), 0);
  const maxPossibleDiff = keys.length * 9; // each dim is 1-10, max diff per dim is 9
  return 1 - totalDiff / maxPossibleDiff;
}

/**
 * 0-1 score: how well this teacher has performed for THIS learner historically,
 * based on past engagement signals on that teacher's videos.
 * Returns 0.5 (neutral) if no history exists — new teacher, no bias either way.
 */
function teacherAffinityScore(teacherId: string, allSessions: EngagementSession[]): number {
  const teacherSessions = allSessions.filter((s) => s.teacherId === teacherId);
  if (teacherSessions.length === 0) return 0.5;

  const signalValue: Record<string, number> = {
    like: 1,
    neutral: 0.5,
    dislike: 0.15,
    strong_dislike: 0,
  };

  const total = teacherSessions.reduce((sum, s) => sum + (signalValue[s.signal] ?? 0.5), 0);
  return total / teacherSessions.length;
}

function scoreCandidate(
  video: AnalyzedVideo,
  learnerDimensions: TeachingDimensions,
  currentTeacherId: string | undefined,
  allSessions: EngagementSession[]
): number {
  const dimScore = dimensionMatchScore(video.dimensions, learnerDimensions);
  const affinityScore = teacherAffinityScore(video.teacherId, allSessions);
  const continuity = currentTeacherId && video.teacherId === currentTeacherId ? 1 : 0;

  return (
    WEIGHTS.dimensionMatch * dimScore +
    WEIGHTS.teacherAffinity * affinityScore +
    WEIGHTS.continuityBonus * continuity
  );
}

// ---- Public API ----

/**
 * Selects the primary video + 2 fallbacks for a single concept.
 * Call this once per concept when the student reaches it in the roadmap.
 *
 * @param candidates   pre-analyzed candidate pool for this concept (5-10 videos)
 * @param learnerProfile  the student's current LearningProfile (from quiz / PersonalizationEngine)
 * @param currentTeacherId  teacherId of the last-completed video for this concept, if any (for continuity) — see getLastTeacherForConcept()
 * @param timing  optional hours/week + deadline the user picked for this topic/custom playlist.
 *                When the resulting time budget is tight, the learner's effective pace
 *                preference is nudged up so faster-paced videos are favored — see
 *                adjustPaceForUrgency(). Omit or pass { hours: 0, deadline: 'none' } for no effect.
 */
export function selectPlaylistForConcept(
  candidates: AnalyzedVideo[],
  learnerProfile: LearningProfile,
  currentTeacherId?: string,
  timing?: PlaylistTiming
): PlaylistResult | null {
  if (candidates.length === 0) return null;

  const learnerDimensions = dimensionsFromLearningProfile(learnerProfile);
  learnerDimensions.pace = adjustPaceForUrgency(learnerDimensions.pace, timing);

  const allSessions = getEngagementSessions();

  const scored = candidates
    .map((video) => ({
      video,
      score: scoreCandidate(video, learnerDimensions, currentTeacherId, allSessions),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const currentTeacherPick = scored.find((s) => s.video.teacherId === currentTeacherId);

  // Apply switch threshold: only actually switch teacher if best is meaningfully
  // ahead of the current teacher's best option for this concept.
  let primary = best;
  let teacherSwitched = currentTeacherId ? best.video.teacherId !== currentTeacherId : false;

  if (
    currentTeacherId &&
    currentTeacherPick &&
    currentTeacherPick.video.teacherId !== best.video.teacherId &&
    best.score - currentTeacherPick.score < SWITCH_THRESHOLD
  ) {
    primary = currentTeacherPick;
    teacherSwitched = false;
  }

  const remaining = scored.filter((s) => s.video.videoId !== primary.video.videoId);

  return {
    primary: primary.video,
    fallbacks: remaining.slice(0, 2).map((s) => s.video),
    teacherSwitched,
  };
}

/**
 * Call after each completed video (once implicit + explicit feedback has
 * updated the LearningProfile). Re-scores the remaining candidate pool for
 * the CURRENT concept — use this instead of selectPlaylistForConcept when
 * the student hasn't moved to a new concept, only their profile changed.
 *
 * @param timing  same optional hours/week + deadline as selectPlaylistForConcept,
 *                so reranking after a completed video keeps respecting the same
 *                urgency the student set when they started this topic.
 */
export function rerankRemaining(
  remainingCandidates: AnalyzedVideo[],
  updatedLearnerProfile: LearningProfile,
  currentTeacherId?: string,
  timing?: PlaylistTiming
): AnalyzedVideo[] {
  const learnerDimensions = dimensionsFromLearningProfile(updatedLearnerProfile);
  learnerDimensions.pace = adjustPaceForUrgency(learnerDimensions.pace, timing);

  const allSessions = getEngagementSessions();

  return remainingCandidates
    .map((video) => ({
      video,
      score: scoreCandidate(video, learnerDimensions, currentTeacherId, allSessions),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.video);
}

/**
 * Converts a scored AnalyzedVideo into the `Video` shape VideoIntel.tsx
 * expects, so a ranked pick can be handed off directly to the player.
 */
export function analyzedVideoToVideo(av: AnalyzedVideo): Video {
  return {
    id: av.videoId,
    title: av.title,
    thumbnail: av.thumbnail,
    channel: av.channel,
    channelId: av.teacherId,
    views: '—',
    duration: '—',
  };
}

/**
 * Looks at past engagement sessions tagged with this conceptId and returns
 * the teacherId of the most recent one — used as `currentTeacherId` input
 * to selectPlaylistForConcept() for teacher-continuity scoring. Returns
 * undefined if this concept has never been watched before (first visit).
 */
export function getLastTeacherForConcept(conceptId: string): string | undefined {
  const sessions = getEngagementSessions()
    .filter((s) => s.conceptId === conceptId && s.teacherId)
    .sort((a, b) => new Date(b.sessionTimestamp).getTime() - new Date(a.sessionTimestamp).getTime());
  return sessions[0]?.teacherId;
}

/**
 * Convenience: pulls this specific video's own session history — useful for
 * showing "students like you rated this X" hints, or for debugging why a
 * video was/wasn't picked.
 */
export function getVideoTrackRecord(videoId: string) {
  return getEngagementSessionsForVideo(videoId);
}