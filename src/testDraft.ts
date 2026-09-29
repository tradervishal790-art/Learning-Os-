// src/testDraft.ts
// Saves an in-progress test (answers, palette status, current question, start time)
// so a refresh / tab close doesn't lose it. Local only. Time keeps running from
// startedAt, like a real exam, so an expired draft auto-submits when reopened.
import type { TestPaper, TestUserAnswer } from './types';

const KEY = 'learning_os_test_draft';

export interface TestDraft {
  paper: TestPaper;
  answers: TestUserAnswer[];
  statusMap: Record<string, string>;
  step: number;
  startedAt: number; // epoch ms
}

export function loadDraft(): TestDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as TestDraft;
    if (!d?.paper?.questions?.length || !Array.isArray(d.answers) || typeof d.startedAt !== 'number') return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(d: TestDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Non-critical.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Non-critical.
  }
}
