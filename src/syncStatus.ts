import { useSyncExternalStore } from 'react';

// ============================================================
// syncStatus.ts — which local-first stores have a cloud write that did NOT land.
// cloudSync.pushToCloud() reports here, so the app can tell the student honestly
// ("saved on this device, not on your account yet") and retry — instead of failing silently.
// Pure state + subscribe (no Firebase here), so it is easy to test.
// ============================================================

export interface FailedPush {
  uid: string;
  key: string;
  /** 'write' = save `data` to the cloud; 'delete' = remove the cloud copy (a failed delete would bring the item back on the next sync). */
  op: 'write' | 'delete';
  data: unknown;
  /** failed attempts so far (drives the retry back-off) */
  tries: number;
}

const failed = new Map<string, FailedPush>();
const listeners = new Set<() => void>();
let count = 0;

function emit(): void {
  count = failed.size;
  listeners.forEach((l) => l());
}

/** The newest write for `key` did not reach the cloud. Keeps the latest data so a retry sends the newest version. */
export function recordFailure(uid: string, key: string, data: unknown, op: 'write' | 'delete' = 'write'): void {
  const prev = failed.get(key);
  failed.set(key, { uid, key, op, data, tries: (prev?.uid === uid ? prev.tries : 0) + 1 });
  emit();
}

/** The newest write for `key` landed (or the key no longer needs syncing). */
export function recordSuccess(key: string): void {
  if (failed.delete(key)) emit();
}

/** Forget everything that belongs to another account (sign-out / account switch). */
export function dropOtherAccounts(currentUid: string | null): void {
  let changed = false;
  for (const [k, v] of failed) {
    if (v.uid !== currentUid) {
      failed.delete(k);
      changed = true;
    }
  }
  if (changed) emit();
}

export const failedPushes = (): FailedPush[] => [...failed.values()];
export const failedSyncCount = (): number => count;
export const maxFailedTries = (): number => failedPushes().reduce((m, f) => Math.max(m, f.tries), 0);

export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** For the UI: how many stores currently have changes that exist only on this device. */
export function useFailedSyncCount(): number {
  return useSyncExternalStore(subscribeSyncStatus, failedSyncCount, () => 0);
}

/** Tests only. */
export function resetSyncStatus(): void {
  failed.clear();
  emit();
}
