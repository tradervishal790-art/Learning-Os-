import type { EngagementSession } from './types';

// Single choke-point for engagement persistence. Right now it writes to
// localStorage (matches the pattern used elsewhere in this app — onboarding
// data, watch history, active-day streak). Swapping to Firestore later means
// changing ONLY this file:
//
//   import { db } from './firebase';
//   import { addDoc, collection } from 'firebase/firestore';
//   export async function saveEngagementSession(session: EngagementSession) {
//     await addDoc(collection(db, 'video_engagement'), session);
//   }
//
// No other file needs to change — VideoIntel.tsx only calls saveEngagementSession().

const ENGAGEMENT_STORAGE_KEY = 'video_engagement_sessions';
const MAX_STORED_SESSIONS = 200; // avoid unbounded localStorage growth

export function saveEngagementSession(session: EngagementSession): void {
  try {
    const existing = getEngagementSessions();
    existing.push(session);
    const trimmed = existing.slice(-MAX_STORED_SESSIONS);
    localStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable — fail silently, tracking is best-effort.
  }
}

/**
 * Creates the row on first call for a given session id, then updates the
 * same row on every subsequent call (pause, seek, feedback, video switch).
 * This means a partial session is still saved even if the user closes the
 * tab mid-video instead of losing all data until a "final" save.
 */
export function upsertEngagementSession(session: EngagementSession): void {
  try {
    const existing = getEngagementSessions();
    const index = existing.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      existing[index] = session;
    } else {
      existing.push(session);
    }
    const trimmed = existing.slice(-MAX_STORED_SESSIONS);
    localStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable — fail silently, tracking is best-effort.
  }
}

export function getEngagementSessions(): EngagementSession[] {
  try {
    const saved = localStorage.getItem(ENGAGEMENT_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as EngagementSession[]) : [];
  } catch {
    return [];
  }
}

/** All sessions for a specific video — useful later for per-video analytics. */
export function getEngagementSessionsForVideo(videoId: string): EngagementSession[] {
  return getEngagementSessions().filter((s) => s.videoId === videoId);
}