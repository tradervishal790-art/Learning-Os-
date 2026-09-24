import { pushToCloud, pullFromCloud } from './cloudSync';
import type { TestPaper } from './types';

// ============================================================
// testBankStore.ts
// Stores the test papers Vishal builds himself in the in-app test
// builder (Test.tsx "Create Test" flow) — title, topic, duration, and
// the question list. No AI involved: this is just a CRUD data store,
// same localStorage + best-effort Firestore push/pull pattern as every
// other store in the app (see revisionstore.ts / testStore.ts).
// ============================================================

const TEST_BANK_STORAGE_KEY = 'learning_os_test_bank';
const CLOUD_KEY = 'testBank';

function loadPapers(): TestPaper[] {
  try {
    const saved = localStorage.getItem(TEST_BANK_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePapers(papers: TestPaper[]): void {
  try {
    localStorage.setItem(TEST_BANK_STORAGE_KEY, JSON.stringify(papers));
  } catch {
    // Storage full/unavailable — non-critical, papers just won't persist locally.
  }
  void pushToCloud(CLOUD_KEY, papers);
}

/** Called once on sign-in (see AuthGate.tsx), same as hydrateRevisionFromCloud. */
export async function hydrateTestBankFromCloud(): Promise<void> {
  if (loadPapers().length > 0) return; // this device already has papers — don't clobber them
  const cloud = await pullFromCloud<TestPaper[]>(CLOUD_KEY);
  if (cloud && cloud.length > 0) {
    try {
      localStorage.setItem(TEST_BANK_STORAGE_KEY, JSON.stringify(cloud));
    } catch {
      // Best-effort.
    }
  }
}

export function getTestPapers(): TestPaper[] {
  return loadPapers().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)); // most recently edited first
}

export function getTestPaper(id: string): TestPaper | undefined {
  return loadPapers().find((p) => p.id === id);
}

export function saveTestPaper(paper: TestPaper): void {
  const papers = [paper, ...loadPapers().filter((p) => p.id !== paper.id)];
  savePapers(papers);
}

export function deleteTestPaper(id: string): void {
  savePapers(loadPapers().filter((p) => p.id !== id));
}
