import type { PersonalityProfile } from './personalityScoring';
import { pushToCloud, pullFromCloud, deleteFromCloud } from './cloudSync';

// ============================================================
// personalityProfileStore.ts
//
// Stores the Big Five screen result (PersonalityQuiz.tsx). Separate from the
// learning-style profile (learningProfileStore.ts) on purpose — it never
// overwrites or blends into it. Same pattern: localStorage is the
// synchronous source of truth, plus best-effort Firestore sync.
// ============================================================

const STORAGE_KEY = 'learning_os_personality_profile';
const CLOUD_KEY = 'personalityProfile';

export function getPersonalityProfile(): PersonalityProfile | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as PersonalityProfile) : null;
  } catch {
    return null;
  }
}

export function savePersonalityProfile(profile: PersonalityProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Best-effort.
  }
  void pushToCloud(CLOUD_KEY, profile);
}

/** Called once on sign-in; never overwrites a profile this device already has. */
export async function hydratePersonalityProfileFromCloud(): Promise<void> {
  if (getPersonalityProfile()) return;
  const cloud = await pullFromCloud<PersonalityProfile>(CLOUD_KEY);
  if (cloud) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
    } catch {
      // Best-effort.
    }
  }
}

export function clearPersonalityProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
  void deleteFromCloud(CLOUD_KEY);
}
