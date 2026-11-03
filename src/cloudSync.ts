import { auth, db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { serverIso } from './serverClock';
import { dropOtherAccounts, failedPushes, failedSyncCount, maxFailedTries, recordFailure, recordSuccess } from './syncStatus';

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

// Test seam: lets unit tests replace the Firestore write and the signed-in user.
let writeDoc: (uid: string, key: string, data: unknown) => Promise<void> = (uid, key, data) =>
  setDoc(doc(db, 'users', uid, 'data', key), { value: data, updatedAt: serverIso() });
let uidOf: () => string | null = currentUid;
let removeDoc: (uid: string, key: string) => Promise<void> = (uid, key) => deleteDoc(doc(db, 'users', uid, 'data', key));
export function __setCloudSyncTestHooks(h: { write?: typeof writeDoc; remove?: typeof removeDoc; uid?: () => string | null }): void {
  if (h.write) writeDoc = h.write;
  if (h.remove) removeDoc = h.remove;
  if (h.uid) uidOf = h.uid;
}

// Newest write per key: an older, slower write must never mark a newer one as done (or as failed).
const pushSeq = new Map<string, number>();
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/** Cloud write that never throws (the caller's local write already succeeded) — but a failure is NOT silent:
 *  it is remembered (syncStatus.ts), shown to the student, and retried when the network is back. */
export async function pushToCloud<T>(key: string, data: T): Promise<void> {
  const uid = uidOf();
  if (!uid) return; // not signed in — local-only for now, nothing to sync
  const seq = (pushSeq.get(key) ?? 0) + 1;
  pushSeq.set(key, seq);
  try {
    await writeDoc(uid, key, data);
    if (pushSeq.get(key) === seq) recordSuccess(key);
  } catch {
    // Network/permission issue — localStorage still has the data, so the UI never blocks; but remember it for a retry.
    if (pushSeq.get(key) === seq) {
      recordFailure(uid, key, data);
      scheduleRetry();
    }
  }
}

/** Send every change that has not reached the cloud yet. Resolves true when nothing is left to sync. */
export async function retryFailedSyncs(): Promise<boolean> {
  dropOtherAccounts(uidOf());
  await Promise.all(failedPushes().map((f) => (f.op === 'delete' ? deleteFromCloud(f.key) : pushToCloud(f.key, f.data))));
  return failedSyncCount() === 0;
}

function scheduleRetry(): void {
  if (typeof window === 'undefined' || retryTimer !== undefined) return;
  // 15 s, 30 s, 60 s … capped at 5 min, so a rejected write (permissions) does not hammer the server.
  const wait = Math.min(300_000, 15_000 * 2 ** Math.max(0, maxFailedTries() - 1));
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void retryFailedSyncs().then((done) => {
      if (!done) scheduleRetry();
    });
  }, wait);
  (retryTimer as unknown as { unref?: () => void }).unref?.(); // never keeps a test / server process alive
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // The network came back: try right away instead of waiting for the timer.
  window.addEventListener('online', () => {
    if (failedSyncCount() > 0) void retryFailedSyncs();
  });
}

/** Like pushToCloud, but tells the caller whether the write really landed
 *  (false = signed out / offline / rejected). Used by stores that show a
 *  truthful "synced / not synced yet" status (the notebook). */
export async function pushToCloudChecked<T>(key: string, data: T): Promise<boolean> {
  const uid = currentUid();
  if (!uid) return false;
  try {
    await setDoc(doc(db, 'users', uid, 'data', key), {
      value: data,
      updatedAt: serverIso(),
    });
    return true;
  } catch {
    return false;
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

/** Deletes the cloud copy for this key — call alongside a store's local "clear" action.
 *  A failed delete is remembered and retried like a failed write (otherwise the deleted item comes back from the cloud). */
export async function deleteFromCloud(key: string): Promise<void> {
  const uid = uidOf();
  if (!uid) return;
  const seq = (pushSeq.get(key) ?? 0) + 1;
  pushSeq.set(key, seq);
  try {
    await removeDoc(uid, key);
    if (pushSeq.get(key) === seq) recordSuccess(key);
  } catch {
    if (pushSeq.get(key) === seq) {
      recordFailure(uid, key, null, 'delete');
      scheduleRetry();
    }
  }
}

/** Live listener for one synced key. Fires only for changes that really came from the server
 *  (not this device's own pending writes), so the other device's edits show up without re-login.
 *  Returns an unsubscribe function. Signed out = does nothing. */
export function subscribeCloud<T>(key: string, onChange: (value: T | null) => void): () => void {
  const uid = currentUid();
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, 'users', uid, 'data', key),
    (snap) => {
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      onChange(snap.exists() ? ((snap.data()?.value as T) ?? null) : null);
    },
    () => {
      // Permission / network error — the app keeps working on local data.
    }
  );
}
