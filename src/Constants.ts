/**
 * constants.ts
 *
 * NOTE: GEMINI_MODEL below is currently unused — all Gemini calls go
 * through the server-side proxy in api/_lib/aiFallback.ts, which has its
 * own DEFAULT_GEMINI_MODEL. Keeping this in sync in case anything
 * client-side starts referencing it again.
 */
export const GEMINI_MODEL = "gemini-3-flash-preview";

export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/** Max candidate videos carried forward from search into analysis/scoring. */
export const MAX_CANDIDATES = 8;

/** Scoring weights used by PlaylistBuilder.ts — kept here so they're visible
 *  in one place instead of buried in the scoring function. */
export const SCORE_WEIGHTS = {
  dimensionMatch: 0.5,
  teacherAffinity: 0.3,
  continuityBonus: 0.2,
} as const;