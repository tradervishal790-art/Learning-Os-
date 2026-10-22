import type { LearningProfile } from './types';
import type { DeepDiveSignals, DimensionKey } from './deepDiveScoring';
import { pushToCloud, pullFromCloud, deleteFromCloud } from './cloudSync';

// ============================================================
// learningProfileStore.ts
//
// Single choke-point for reading/writing the student's LearningProfile
// (quiz result). Previously this lived inline inside Dashboard.tsx —
// extracted here so Roadmap.tsx (and anything else building a
// personalized playlist) can read it too, without duplicating the key
// or the parsing logic.
//
// CROSS-DEVICE SYNC: localStorage stays the synchronous source of truth
// (every existing caller of getLearningProfile()/saveLearningProfile()
// is untouched). On top of that, saves also fire a best-effort Firestore
// write (see cloudSync.ts), and hydrateLearningProfileFromCloud() — called
// once on sign-in from AuthGate.tsx — pulls the cloud copy down into
// localStorage on a device that doesn't have it yet.
// ============================================================

const LEARNING_PROFILE_STORAGE_KEY = 'learning_os_learning_profile';
const CLOUD_KEY = 'learningProfile';

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

/**
 * In-memory neutral profile (every dimension at the 0-10 midpoint) for callers
 * that must never block a learner who hasn't taken the quiz/interview yet —
 * e.g. building a video playlist. Deliberately NOT persisted or synced: saving
 * it would make the app believe a quiz was completed, hide the "take the
 * quiz" prompts, and pollute the rolling implicit-profile updates.
 */
export function getNeutralLearningProfile(): LearningProfile {
  return {
    pace: 5,
    theoryVsPractical: 5,
    structureNeed: 5,
    depth: 5,
    languageComplexity: 5,
    storytelling: 5,
    repetitionNeed: 5,
    priorKnowledgeComfort: 5,
    reliabilityScore: 0,
    selfReportedHonesty: 'declined',
    completedAt: new Date(0).toISOString(),
  };
}

/** The saved profile if there is one, otherwise the neutral default. Never null. */
export function getLearningProfileOrNeutral(): LearningProfile {
  return getLearningProfile() ?? getNeutralLearningProfile();
}

export function saveLearningProfile(profile: LearningProfile): void {
  try {
    localStorage.setItem(LEARNING_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage full or unavailable — best-effort, not a critical failure.
  }
  // Fire-and-forget cloud sync — caller doesn't await this, so save stays
  // instant/synchronous for the UI. If it fails (offline, signed out),
  // localStorage above already has the data.
  void pushToCloud(CLOUD_KEY, profile);
}

/**
 * Called once, the first time the user reaches the dashboard (see
 * App.tsx), to pull this user's profile
 * down from Firestore into localStorage — the step that actually makes
 * the profile show up on a NEW device/browser instead of only ever being
 * visible on the device it was created on.
 *
 * Deliberately does NOT overwrite a newer local profile: if this device
 * already has a profile (e.g. user retook the Blueprint Interview while
 * briefly offline), the local copy wins and gets re-pushed up instead —
 * last-write-wins by "device already has data", not by timestamp, to
 * keep this a simple v1.
 */
export async function hydrateLearningProfileFromCloud(): Promise<void> {
  if (getLearningProfile()) return; // this device already has a profile — don't clobber it
  const cloudProfile = await pullFromCloud<LearningProfile>(CLOUD_KEY);
  if (cloudProfile) {
    try {
      localStorage.setItem(LEARNING_PROFILE_STORAGE_KEY, JSON.stringify(cloudProfile));
    } catch {
      // Best-effort.
    }
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
  void deleteFromCloud(CLOUD_KEY);
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