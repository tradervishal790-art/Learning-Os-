import type { DimensionKey, DeepDiveSignals } from './deepDiveScoring';
import type { TasteVideoResult, LearningProfile } from './types';

// ============================================================
// tasteProfileScoring.ts
//
// Converts analyze-taste-video.ts's per-video contentProfile (snake_case,
// matching analyze-video.ts's DIMENSION_PROMPT output) into the same
// camelCase DimensionKey shape used everywhere else in the app, then
// averages across all successfully-analyzed videos. Deliberately reuses
// DimensionKey/DeepDiveSignals + mergeLearningProfile's blend logic
// (learningProfileStore.ts) instead of a parallel profile system.
// ============================================================

// Maps analyze-video.ts's snake_case JSON keys → LearningProfile's
// camelCase DimensionKeys.
const KEY_MAP: Record<string, DimensionKey> = {
  pace: 'pace',
  theory_vs_practical: 'theoryVsPractical',
  structure: 'structureNeed',
  depth: 'depth',
  language_complexity: 'languageComplexity',
  storytelling: 'storytelling',
  repetition: 'repetitionNeed',
  prerequisite_assumed: 'priorKnowledgeComfort',
};

/** Averages contentProfile dimensions across every video that has a valid
 *  contentProfile. Videos where scoring failed upstream simply won't have
 *  usable numeric fields and are skipped per-dimension, not all-or-nothing. */
export function averageTasteSignals(results: TasteVideoResult[]): DeepDiveSignals {
  const sums: Partial<Record<DimensionKey, number>> = {};
  const counts: Partial<Record<DimensionKey, number>> = {};

  for (const result of results) {
    if (!result.contentProfile) continue;
    for (const [rawKey, mappedKey] of Object.entries(KEY_MAP)) {
      const val = result.contentProfile[rawKey];
      if (typeof val === 'number' && val >= 1 && val <= 10) {
        sums[mappedKey] = (sums[mappedKey] ?? 0) + val;
        counts[mappedKey] = (counts[mappedKey] ?? 0) + 1;
      }
    }
  }

  const signals: DeepDiveSignals = {};
  (Object.keys(sums) as DimensionKey[]).forEach((key) => {
    const count = counts[key] ?? 0;
    if (count > 0) signals[key] = Math.round((sums[key] as number) / count);
  });
  return signals;
}

/** Builds a brand-new LearningProfile from taste-video signals alone, for
 *  users who skip the Blueprint Interview entirely and go straight to
 *  video-taste onboarding. Dimensions the videos didn't cover default to
 *  the neutral midpoint (5) rather than being left undefined. */
export function buildFreshProfileFromTaste(signals: DeepDiveSignals, videoCount: number): LearningProfile {
  const DIMENSION_KEYS: DimensionKey[] = [
    'pace',
    'theoryVsPractical',
    'structureNeed',
    'depth',
    'languageComplexity',
    'storytelling',
    'repetitionNeed',
    'priorKnowledgeComfort',
  ];
  const filled: Record<DimensionKey, number> = {} as Record<DimensionKey, number>;
  DIMENSION_KEYS.forEach((key) => {
    filled[key] = signals[key] ?? 5;
  });

  return {
    ...filled,
    // Derived from real watched videos, not self-report — 'honest' is the
    // closest existing status; reliabilityScore reflects video count as a
    // rough confidence proxy (more videos = more reliable average).
    reliabilityScore: Math.min(95, 60 + videoCount * 5),
    selfReportedHonesty: 'honest',
    completedAt: new Date().toISOString(),
    blueprintReport: `${videoCount} pehle-se-dekhe-hue video(s) ke content analysis se banaya gaya profile.`,
  };
}
