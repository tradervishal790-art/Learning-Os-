import { auth, db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// ============================================================
// cloudSync.ts
//
// Generic per-user Firestore sync layer — Firestore path:
//   users/{uid}/data/{key}
//
// DESIGN: every store (learningProfileStore, roadmapData, revisionstore,
// progressData, goalsStore) keeps its EXISTING localStorage read/write as
// the source of truth for synchronous reads — nothing else in the app has
// to become async or change its call sites. This layer only adds two
// things on top of that:
//
//   1. pushToCloud() — fire-and-forget write to Firestore, called right
//      after the existing localStorage write. Best-effort: if it fails
//      (offline, no auth), localStorage already has the data, so the UI
//      never breaks or blocks on it.
//
//   2. pullFromCloud() — one-time read, called once on sign-in (see
//      AuthGate.tsx) to hydrate localStorage on a NEW device/browser
//      where localStorage is empty but the account already has cloud
//      data from another device.
//
// This is the same pattern engagementStore.ts already sketched in a
// comment ("Swapping to Firestore later means changing ONLY this file") —
// generalized so every store can opt in with ~3 lines each.
// ============================================================

function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

/** Best-effort cloud write. Never throws — caller's localStorage write already succeeded. */
export async function pushToCloud<T>(key: string, data: T): Promise<void> {
  const uid = currentUid();
  if (!uid) return; // not signed in — local-only for now, nothing to sync
  try {
    await setDoc(doc(db, 'users', uid, 'data', key), {
      value: data,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Network/permission issue — localStorage still has the data, don't block the UI.
  }
}

/** Returns the cloud value for this key, or null if signed out / not found / offline. */
export async function pullFromCloud<T>(key: string): Promise<T | null> {
  const uid = currentUid();
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', key));
    if (!snap.exists()) return null;
    return (snap.data()?.value as T) ?? null;
  } catch {
    return null;
  }
}

/** Deletes the cloud copy for this key — call alongside a store's local "clear" action. */
export async function deleteFromCloud(key: string): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'data', key));
  } catch {
    // Best-effort.
  }
}
