import { auth, db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { serverIso } from './serverClock';

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
  const user = auth.currentUser;
  return user && !user.isAnonymous ? user.uid : null;
}

/**
 * Merge local guest work into the account that the guest just upgraded to
 * or signed into. Guest sessions never write to Firestore; this is the
 * deliberate hand-off point from device-only storage to account sync.
 *
 * Core app stores are copied to their existing cloud document keys. Other
 * Learning OS localStorage entries are preserved under a namespaced local:
 * document so no guest work is silently discarded during the transition.
 */
export async function mergeGuestLocalDataToAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  let localEntries: Array<[string, unknown]> = [];
  try {
    localEntries = Object.keys(localStorage)
      .filter((key) => key.startsWith('learning_os_'))
      .flatMap((key) => {
        const raw = localStorage.getItem(key);
        if (raw === null) return [];
        try {
          return [[key, JSON.parse(raw)] as [string, unknown]];
        } catch {
          return [[key, raw] as [string, unknown]];
        }
      });
  } catch {
    return;
  }
  if (localEntries.length === 0) return;

  const cloudKeyForLocalKey = (key: string): string => {
    if (key === 'learning_os_onboarding_data') return 'onboardingData';
    if (key === 'learning_os_goals') return 'goals';
    if (key === 'learning_os_generated_roadmap') return 'roadmap:primary';
    if (key.startsWith('learning_os_generated_roadmap:')) {
      return `roadmap:${key.slice('learning_os_generated_roadmap:'.length)}`;
    }
    if (key === 'learning_os_learning_profile') return 'learningProfile';
    if (key === 'learning_os_personality_profile') return 'personalityProfile';
    if (key === 'learning_os_active_days') return 'activeDays';
    if (key === 'learning_os_test_attempts') return 'testAttempts';
    return `local:${key.split('/').join('_')}`;
  };

  const mergeValues = (localValue: unknown, accountValue: unknown, field = ''): unknown => {
    if (Array.isArray(localValue) && Array.isArray(accountValue)) {
      const identity = (item: unknown): string => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          for (const candidate of ['id', 'videoId', 'noteId', 'topicId', 'sessionId']) {
            if (typeof record[candidate] === 'string') return `${candidate}:${record[candidate]}`;
          }
        }
        return JSON.stringify(item);
      };
      const merged = new Map<string, unknown>();
      // Account values are inserted first and remain authoritative on conflicts.
      for (const item of accountValue) merged.set(identity(item), item);
      for (const item of localValue) {
        const key = identity(item);
        merged.set(key, merged.has(key) ? mergeValues(item, merged.get(key), field) : item);
      }
      return [...merged.values()];
    }
    if (
      localValue && accountValue &&
      typeof localValue === 'object' && typeof accountValue === 'object' &&
      !Array.isArray(localValue) && !Array.isArray(accountValue)
    ) {
      const localRecord = localValue as Record<string, unknown>;
      const accountRecord = accountValue as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...localRecord, ...accountRecord };
      for (const key of Object.keys(localRecord)) {
        if (key in accountRecord) merged[key] = mergeValues(localRecord[key], accountRecord[key], key);
      }
      return merged;
    }
    if (field === 'status' && typeof localValue === 'string' && typeof accountValue === 'string') {
      const rank: Record<string, number> = { locked: 0, learning: 1, completed: 2, mastered: 3 };
      if (localValue in rank && accountValue in rank) {
        return rank[localValue] > rank[accountValue] ? localValue : accountValue;
      }
    }
    return accountValue === undefined || accountValue === null ? localValue : accountValue;
  };

  const entries = localEntries.flatMap(([localKey, value]) => {
    const refs = [
      doc(db, 'users', user.uid, 'data', `local:${localKey.split('/').join('_')}`),
    ];
    const appCloudKey = cloudKeyForLocalKey(localKey);
    if (appCloudKey !== `local:${localKey.split('/').join('_')}`) {
      refs.push(doc(db, 'users', user.uid, 'data', appCloudKey));
    }
    return refs.map((ref) => ({ ref, value }));
  });

  try {
    await runTransaction(db, async (transaction) => {
      const snapshots = await Promise.all(entries.map(({ ref }) => transaction.get(ref)));
      const updatedAt = serverIso();
      entries.forEach(({ ref, value }, index) => {
        const existing = snapshots[index].exists() ? snapshots[index].data()?.value : null;
        transaction.set(ref, {
          value: existing === null || existing === undefined ? value : mergeValues(value, existing),
          updatedAt,
        });
      });
    });
  } catch (error) {
    // Keep all guest data on this device if account sync is temporarily unavailable.
    console.warn('Guest data merge did not complete; local data is preserved.', error);
  }
}

/**
 * Restore local-only guest records on a device where the account is already
 * signed in. Existing local values are never overwritten; normal store
 * hydration continues to handle its own cloud documents.
 */
export async function hydrateLocalDataFromAccount(): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'data'));
    snapshot.forEach((entry) => {
      if (!entry.id.startsWith('local:')) return;
      const localKey = entry.id.slice('local:'.length);
      if (!localKey.startsWith('learning_os_')) return;
      try {
        if (localStorage.getItem(localKey) !== null) return;
        const value = entry.data()?.value;
        if (value === undefined) return;
        localStorage.setItem(localKey, typeof value === 'string' ? value : JSON.stringify(value));
      } catch {
        // One unavailable key must not block restoring the remaining guest data.
      }
    });
  } catch {
    // Cloud unavailable — this device can still use any local data it already has.
  }
}

/** Best-effort cloud write. Never throws — caller's localStorage write already succeeded. */
export async function pushToCloud<T>(key: string, data: T): Promise<void> {
  const uid = currentUid();
  if (!uid) return; // not signed in — local-only for now, nothing to sync
  try {
    await setDoc(doc(db, 'users', uid, 'data', key), {
      value: data,
      updatedAt: serverIso(),
    });
  } catch {
    // Network/permission issue — localStorage still has the data, don't block the UI.
  }
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
