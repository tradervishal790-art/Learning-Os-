import type { LearningProfile } from './types';

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