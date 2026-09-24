import { pushToCloud, pullFromCloud } from './cloudSync';
import type { TestAttempt } from './types';

// ============================================================
// testStore.ts
// Persists completed Test.tsx attempts (topic, questions, answers,
// graded results, score) so a learner can revisit past results or
// re-download a PDF without retaking the test. Same localStorage +
// best-effort Firestore push/pull pattern as revisionstore.ts /
// learningProfileStore.ts.
// ============================================================

const TEST_ATTEMPTS_STORAGE_KEY = 'learning_os_test_attempts';
const CLOUD_KEY = 'testAttempts';
const MAX_STORED_ATTEMPTS = 50; // avoid unbounded localStorage growth

function loadAttempts(): TestAttempt[] {
  try {
    const saved = localStorage.getItem(TEST_ATTEMPTS_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAttempts(attempts: TestAttempt[]): void {
  try {
    localStorage.setItem(TEST_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // Storage full/unavailable — non-critical, history just won't persist.
  }
  void pushToCloud(CLOUD_KEY, attempts);
}

/** Called once on sign-in (see AuthGate.tsx), same as hydrateRevisionFromCloud. */
export async function hydrateTestAttemptsFromCloud(): Promise<void> {
  if (loadAttempts().length > 0) return; // this device already has history — don't clobber it
  const cloud = await pullFromCloud<TestAttempt[]>(CLOUD_KEY);
  if (cloud && cloud.length > 0) {
    try {
      localStorage.setItem(TEST_ATTEMPTS_STORAGE_KEY, JSON.stringify(cloud));
    } catch {
      // Best-effort.
    }
  }
}

export function getTestAttempts(): TestAttempt[] {
  return loadAttempts().sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)); // newest first
}

export function getTestAttempt(id: string): TestAttempt | undefined {
  return loadAttempts().find((a) => a.id === id);
}

export function saveTestAttempt(attempt: TestAttempt): void {
  const attempts = [attempt, ...loadAttempts().filter((a) => a.id !== attempt.id)].slice(0, MAX_STORED_ATTEMPTS);
  saveAttempts(attempts);
}

/** Alias of saveTestAttempt — used when the learner self-grades a subjective answer after submit, to persist the updated score. */
export const updateTestAttempt = saveTestAttempt;

export function deleteTestAttempt(id: string): void {
  saveAttempts(loadAttempts().filter((a) => a.id !== id));
}
