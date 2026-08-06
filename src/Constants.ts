/**
 * constants.ts
 *
 * GEMINI_MODEL is the ONLY place the Gemini model name is written.
 * Every file that calls Gemini imports this constant — never hardcode a
 * dated model string (e.g. "gemini-2.5-flash") anywhere else. Dated model
 * names silently 404 or become invalid as Google rotates versions;
 * "-latest" aliases always resolve to the current stable release.
 */
export const GEMINI_MODEL = "gemini-flash-latest";

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