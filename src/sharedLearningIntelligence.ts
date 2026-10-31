import { doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { EngagementSession } from './types';
import { toSharedLearningSample, type SharedLearningCounters } from './sharedLearningSignals';

const CONSENT_STORAGE_KEY = 'learning_os_share_learning_signals_v1';
const MINIMUM_VISIBLE_COHORT = 10;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export interface SharedVideoLearningSummary {
  sampleCount: number;
  earlyDropCount: number;
  partialCount: number;
  nearCompleteCount: number;
  completedCount: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  completedRate: number;
  earlyDropRate: number;
}

export function isSharedLearningEnabled(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Consent is explicit, local to this device, and off by default. */
export function setSharedLearningEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
    else localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // If consent cannot be persisted, fail closed and do not share.
  }
}

function isRealAccount(): boolean {
  return !!auth.currentUser && !auth.currentUser.isAnonymous;
}

/**
 * Contributes one coarse, opt-in sample per account/video.
 *
 * The raw session, user id, video title, topic, profile, and exact watch data
 * are never written to the shared collection. A private per-account marker
 * prevents repeat counting; Firestore rules require that marker and the
 * aggregate increment to be committed atomically.
 */
export async function contributeSharedVideoSignal(session: EngagementSession): Promise<boolean> {
  if (!isSharedLearningEnabled() || !isRealAccount() || !YOUTUBE_VIDEO_ID.test(session.videoId)) return false;

  const sample = toSharedLearningSample(session);
  if (!sample) return false;

  const uid = auth.currentUser!.uid;
  const contributionRef = doc(db, 'users', uid, 'learningIntelligence', session.videoId);
  const aggregateRef = doc(db, 'shared_learning_video_stats', session.videoId);
  const increments: SharedLearningCounters = {
    sampleCount: 1,
    earlyDropCount: sample.outcome === 'early-drop' ? 1 : 0,
    partialCount: sample.outcome === 'partial' ? 1 : 0,
    nearCompleteCount: sample.outcome === 'near-complete' ? 1 : 0,
    completedCount: sample.outcome === 'completed' ? 1 : 0,
    positiveFeedbackCount: sample.feedback === 'like' ? 1 : 0,
    negativeFeedbackCount: sample.feedback === 'dislike' ? 1 : 0,
  };

  try {
    const batch = writeBatch(db);
    batch.set(contributionRef, {
      outcome: sample.outcome,
      feedback: sample.feedback,
      submittedAt: serverTimestamp(),
    });
    batch.set(aggregateRef, {
      ...Object.fromEntries(Object.entries(increments).map(([key, value]) => [key, increment(value)])),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    return true;
  } catch {
    // Duplicate contribution, offline, or rules not deployed: private learning continues normally.
    return false;
  }
}

/** Fetch community outcomes for a candidate set; unavailable or sub-threshold samples are omitted. */
export async function getSharedVideoLearningSummaries(videoIds: string[]): Promise<Record<string, SharedVideoLearningSummary>> {
  const uniqueIds = [...new Set(videoIds)].filter((id) => YOUTUBE_VIDEO_ID.test(id));
  const entries = await Promise.all(uniqueIds.map(async (id) => [id, await getSharedVideoLearningSummary(id)] as const));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, SharedVideoLearningSummary] => entry[1] !== null));
}

/** Reads only aggregate documents whose cohort has reached the 10-account privacy floor. */
export async function getSharedVideoLearningSummary(videoId: string): Promise<SharedVideoLearningSummary | null> {
  if (!auth.currentUser || !YOUTUBE_VIDEO_ID.test(videoId)) return null;
  try {
    const snapshot = await getDoc(doc(db, 'shared_learning_video_stats', videoId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    const sampleCount = Number(data.sampleCount);
    if (!Number.isInteger(sampleCount) || sampleCount < MINIMUM_VISIBLE_COHORT) return null;

    const count = (key: keyof SharedLearningCounters) => {
      const value = Number(data[key]);
      return Number.isInteger(value) && value >= 0 && value <= sampleCount ? value : 0;
    };
    const earlyDropCount = count('earlyDropCount');
    const partialCount = count('partialCount');
    const nearCompleteCount = count('nearCompleteCount');
    const completedCount = count('completedCount');
    const positiveFeedbackCount = count('positiveFeedbackCount');
    const negativeFeedbackCount = count('negativeFeedbackCount');

    return {
      sampleCount,
      earlyDropCount,
      partialCount,
      nearCompleteCount,
      completedCount,
      positiveFeedbackCount,
      negativeFeedbackCount,
      completedRate: Math.round((completedCount / sampleCount) * 100),
      earlyDropRate: Math.round((earlyDropCount / sampleCount) * 100),
    };
  } catch {
    return null;
  }
}
