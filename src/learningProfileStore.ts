import type { LearningProfile } from './types';
import type { DeepDiveSignals, DimensionKey } from './deepDiveScoring';

// ============================================================
// learningProfileStore.ts
//
// Single choke-point for reading/writing the student's LearningProfile
// (quiz result). Previously this lived inline inside Dashboard.tsx —
// extracted here so Roadmap.tsx (and anything else building a
// personalized playlist) can read it too, without duplicating the key
// or the parsing logic.
// ============================================================

const LEARNING_PROFILE_STORAGE_KEY = 'learning_os_learning_profile';

// New deep-dive signals are BLENDED into the existing profile, not
// overwritten — one optional conversation shouldn't flip the whole
// profile. 0.35 = new signal gets 35% weight, old profile keeps 65%.
const DEEP_DIVE_BLEND_WEIGHT = 0.35;

export function getLearningProfile(): LearningProfile | null {
  try {
    const saved = localStorage.getItem(LEARNING_PROFILE_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as LearningProfile) : null;
  } catch {
    return null;
  }
}

export function saveLearningProfile(profile: LearningProfile): void {
  try {
    localStorage.setItem(LEARNING_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage full or unavailable — best-effort, not a critical failure.
  }
}

/**
 * Wipes the stored LearningProfile without starting a new interview.
 * Use for a "Clear my data" / "Reset profile" action — downstream code
 * (Roadmap.tsx, PlaylistBuilder.ts) already handles a null profile
 * gracefully by falling back to non-personalized defaults.
 */
export function clearLearningProfile(): void {
  try {
    localStorage.removeItem(LEARNING_PROFILE_STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}

/**
 * Blends optional deep-dive signals into the existing LearningProfile
 * and persists the result. Call this after DeepDiveChat.tsx completes.
 * Returns the updated profile so the caller can use it immediately
 * (e.g. to build the playlist right after merging).
 */
export function mergeLearningProfile(
  existing: LearningProfile,
  newSignals: DeepDiveSignals
): LearningProfile {
  const blended: LearningProfile = { ...existing };

  (Object.keys(newSignals) as DimensionKey[]).forEach((key) => {
    const newVal = newSignals[key];
    if (typeof newVal === 'number') {
      const oldVal = existing[key];
      blended[key] = Math.round(oldVal * (1 - DEEP_DIVE_BLEND_WEIGHT) + newVal * DEEP_DIVE_BLEND_WEIGHT);
    }
  });

  saveLearningProfile(blended);
  return blended;
}