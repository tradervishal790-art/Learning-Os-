import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ============================================================
// sharedVideoCache.ts
//
// A SECOND, separate cache layer for conceptVideoPool.ts — on top of its
// existing per-device localStorage cache. Unlike cloudSync.ts (which syncs
// a signed-in user's OWN data to their OWN private `users/{uid}/...` path),
// everything here lives under a single shared, cross-user Firestore path.
//
// WHY THIS IS SAFE TO SHARE (not a personalization leak): this cache only
// ever stores a video's own, objective teaching-style profile (pace,
// theory-vs-practical, structure, depth — from analyze-video.ts) and which
// candidate videos a given topic+language search turned up. Neither of
// those depends on WHO is asking. The actual personalization — matching a
// specific student's LearningProfile against this pool to pick their best
// video — happens entirely in PlaylistBuilder.ts, using data that never
// touches this cache (learner profile, watch history, timing/deadline).
// Sharing this layer saves everyone's YouTube quota and Gemini cost without
// changing a single student's recommendation.
//
// Firestore paths (flat, top-level — NOT under users/{uid}):
//   shared_video_analysis/{videoId}        — one video's teaching-style profile
//   shared_topic_pools/{poolCacheKey}       — one topic+language's candidate list
//
// Both reads and writes require being signed in (any signed-in user, not
// just the data's "owner" — there is no owner), just as a lightweight
// guard against anonymous abuse; the data itself has no per-user access
// restriction. Needs a Firestore rules addition — see the comment at the
// bottom of this file for the exact rule to add in the Firebase console.
//
// Best-effort throughout, like cloudSync.ts: every function swallows its
// own errors and returns null/void on failure (offline, rules not yet
// deployed, etc.) — conceptVideoPool.ts's existing localStorage-first
// behavior is always the fallback, so nothing here can break video
// matching, it can only make it cheaper/faster when it works.
// ============================================================

function isSignedIn(): boolean {
  return !!auth.currentUser;
}

/** One video's cached teaching-style analysis, shared across every user and every topic it appears under. */
export async function pullSharedVideoAnalysis<T>(videoId: string): Promise<{ profile: T; analysisSource?: string } | null> {
  if (!isSignedIn()) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_video_analysis', videoId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data?.profile) return null;
    return { profile: data.profile as T, analysisSource: data.analysisSource };
  } catch {
    return null; // offline / rules not deployed yet / permission denied
  }
}

/** Fire-and-forget: saves a freshly-analyzed video's profile for every future user asking about the same video. */
export function pushSharedVideoAnalysis<T>(videoId: string, profile: T, analysisSource?: string): void {
  if (!isSignedIn()) return;
  void setDoc(doc(db, 'shared_video_analysis', videoId), {
    profile,
    analysisSource: analysisSource ?? null,
    updatedAt: new Date().toISOString(),
  }).catch(() => {
    // Best-effort — local cache already has it, this just saves it for OTHER users too.
  });
}

/** One topic+language's cached YouTube candidate list, shared across every user who searches the same topic. */
export async function pullSharedTopicPool<T>(poolCacheKey: string): Promise<T[] | null> {
  if (!isSignedIn()) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_topic_pools', poolCacheKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    return Array.isArray(data?.candidates) ? (data.candidates as T[]) : null;
  } catch {
    return null;
  }
}

/** Fire-and-forget: saves a freshly-built candidate pool for every future user who hits the same topic+language. */
export function pushSharedTopicPool<T>(poolCacheKey: string, candidates: T[]): void {
  if (!isSignedIn()) return;
  void setDoc(doc(db, 'shared_topic_pools', poolCacheKey), {
    candidates,
    updatedAt: new Date().toISOString(),
  }).catch(() => {
    // Best-effort.
  });
}

/**
 * Shared cache for the Videos section's manual search (page 1 only).
 * Reuses the existing `shared_topic_pools` collection (key prefixed `search_`),
 * so NO new Firestore rule is needed.
 */
export async function pullSharedSearch<T>(searchKey: string): Promise<{ items: T[]; nextPageToken: string | null } | null> {
  if (!isSignedIn()) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_topic_pools', searchKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!Array.isArray(data?.candidates) || data.candidates.length === 0) return null;
    // Refresh after 30 days so we never serve stale YouTube data.
    const age = Date.now() - new Date(data.updatedAt ?? 0).getTime();
    if (!(age < 30 * 24 * 60 * 60 * 1000)) return null;
    return { items: data.candidates as T[], nextPageToken: data.nextPageToken ?? null };
  } catch {
    return null;
  }
}

/** Fire-and-forget: saves a search's first page so the next user who searches the same thing costs 0 quota. */
export function pushSharedSearch<T>(searchKey: string, items: T[], nextPageToken: string | null): void {
  if (!isSignedIn() || items.length === 0) return;
  void setDoc(doc(db, 'shared_topic_pools', searchKey), {
    candidates: items,
    nextPageToken,
    updatedAt: new Date().toISOString(),
  }).catch(() => {});
}

// ------------------------------------------------------------------------
// FIRESTORE RULES — add this alongside the existing users/{uid}/... rule
// in the Firebase console (Firestore Database -> Rules). Without it, every
// call above fails closed (permission-denied -> caught -> null/no-op) and
// conceptVideoPool.ts silently keeps working exactly as it does today, just
// without the cross-user sharing.
//
//   match /shared_video_analysis/{videoId} {
//     allow read, write: if request.auth != null;
//   }
//   match /shared_topic_pools/{poolId} {
//     allow read, write: if request.auth != null;
//   }
// ------------------------------------------------------------------------
