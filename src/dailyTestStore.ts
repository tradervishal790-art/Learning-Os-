// src/dailyTestStore.ts
// "Daily Test": the learner uploads photos/PDFs ONCE (they become a question bank), picks how
// many questions they want per day, and the app prepares one test per day from that bank.
//
// Rules (decided with Vishal):
//  - The bank is built in the normal test builder (photo/PDF import, bulk paste, manual), so
//    every bank question already has its answer. No AI here at all.
//  - A day's test stays "pending" until it is submitted. If a day is missed, the SAME
//    questions are the next test (nothing is skipped).
//  - After a test is submitted, the next one is prepared on the next calendar day.
//  - Questions don't repeat until the whole bank has been used (a "round"). A new round
//    starts with the questions the learner got wrong, then the rest in random order.
//  - Everything is stored in this browser's localStorage only (no cloud sync) — use
//    exportDailyBackup / importDailyBackup to move it between devices.
import type { GradedResult, TestPaper, TestQuestion } from './types';
import { dedupeQuestions } from './questionDedup';

const KEY = 'learning_os_daily_test';
export const DAILY_PAPER_PREFIX = 'daily_';
export const DEFAULT_PER_DAY = 35;
export const MAX_PER_DAY = 300;

export interface DailyTestState {
  version: 1;
  bank: TestQuestion[];
  perDay: number;
  /** Timer = perDay × minutesPerQuestion. 0 = no timer. */
  minutesPerQuestion: number;
  /** Ids not used yet in the current round, in the order they will be served. */
  queue: string[];
  round: number;
  /** Ids the learner got wrong in daily tests (served first in the next round). */
  wrongIds: string[];
  /** Today's (or the missed day's) prepared test, until it is submitted. */
  pending: TestPaper | null;
  /** Local date (YYYY-MM-DD) of the last submitted daily test. */
  lastCompletedDate: string | null;
  daysCompleted: number;
}

const emptyState = (): DailyTestState => ({
  version: 1,
  bank: [],
  perDay: DEFAULT_PER_DAY,
  minutesPerQuestion: 1,
  queue: [],
  round: 1,
  wrongIds: [],
  pending: null,
  lastCompletedDate: null,
  daysCompleted: 0,
});

/** Local calendar date, e.g. "2026-10-10" (not UTC, so "today" matches the learner's day). */
export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function isQuestionShape(value: unknown): value is TestQuestion {
  if (!value || typeof value !== 'object') return false;
  const q = value as Partial<TestQuestion>;
  if (typeof q.id !== 'string' || !q.id.trim() || typeof q.question !== 'string') return false;
  if (q.type === 'mcq') {
    return Array.isArray(q.options)
      && q.options.every((option) => typeof option === 'string')
      && typeof q.correctIndex === 'number'
      && typeof q.explanation === 'string'
      && typeof q.marks === 'number'
      && typeof q.negativeMarks === 'number';
  }
  if (q.type === 'subjective') {
    return typeof q.modelAnswer === 'string'
      && typeof q.explanation === 'string'
      && typeof q.marks === 'number'
      && (q.acceptedAnswers === undefined
        || (Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.every((answer) => typeof answer === 'string')));
  }
  return false;
}

function isPaperShape(value: unknown): value is TestPaper {
  if (!value || typeof value !== 'object') return false;
  const paper = value as Partial<TestPaper>;
  return typeof paper.id === 'string'
    && typeof paper.title === 'string'
    && typeof paper.topic === 'string'
    && typeof paper.durationMinutes === 'number'
    && Array.isArray(paper.questions)
    && paper.questions.every(isQuestionShape)
    && typeof paper.createdAt === 'string'
    && typeof paper.updatedAt === 'string';
}

function isState(x: unknown): x is DailyTestState {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<DailyTestState>;
  return s.version === 1
    && Array.isArray(s.bank) && s.bank.every(isQuestionShape)
    && Array.isArray(s.queue) && s.queue.every((id) => typeof id === 'string')
    && Array.isArray(s.wrongIds) && s.wrongIds.every((id) => typeof id === 'string')
    && typeof s.perDay === 'number' && Number.isFinite(s.perDay) && s.perDay >= 1 && s.perDay <= MAX_PER_DAY
    && typeof s.minutesPerQuestion === 'number' && Number.isFinite(s.minutesPerQuestion) && s.minutesPerQuestion >= 0 && s.minutesPerQuestion <= 10
    && (s.pending === null || isPaperShape(s.pending))
    && (s.lastCompletedDate === null || (typeof s.lastCompletedDate === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(s.lastCompletedDate)))
    && typeof s.daysCompleted === 'number' && Number.isInteger(s.daysCompleted) && s.daysCompleted >= 0;
}

export function loadDaily(): DailyTestState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return isState(parsed) ? { ...emptyState(), ...parsed } : emptyState();
  } catch {
    return emptyState();
  }
}

/** Returns false if the browser refused to store it (e.g. storage full). */
function saveDaily(s: DailyTestState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Order for a new round: previously-wrong questions first, then the rest shuffled. */
function newRoundOrder(bank: TestQuestion[], wrongIds: string[]): string[] {
  const wrong = new Set(wrongIds);
  const ids = bank.filter(isReadyQuestion).map((q) => q.id);
  return [...shuffle(ids.filter((id) => wrong.has(id))), ...shuffle(ids.filter((id) => !wrong.has(id)))];
}

function isReadyQuestion(q: TestQuestion): boolean {
  if (!isQuestionShape(q) || !q.question.trim()) return false;
  if (q.type === 'mcq') return q.correctIndex >= 0 && q.options.filter((o) => o.trim()).length >= 2;
  return !!q.modelAnswer.trim();
}

export function getReadyDailyQuestionCount(questions: TestQuestion[] = loadDaily().bank): number {
  return questions.filter(isReadyQuestion).length;
}

// ── bank ─────────────────────────────────────────────────────────────

/** Replaces the bank with the builder's question list. New questions join the queue; removed ones leave it. */
export function saveBank(questions: TestQuestion[]): boolean {
  const s = loadDaily();
  // Deduplicate by normalized question wording as well as ID. IDs change when
  // the same paper is imported again, so ID-only checks do not prevent repeats.
  const { questions: uniqueQuestions } = dedupeQuestions(questions);
  const ids = new Set(uniqueQuestions.filter(isReadyQuestion).map((q) => q.id));
  const knownReady = new Set(s.bank.filter(isReadyQuestion).map((q) => q.id));
  const fresh = uniqueQuestions.filter((q) => isReadyQuestion(q) && !knownReady.has(q.id)).map((q) => q.id);
  s.bank = uniqueQuestions;
  // Incomplete imported questions stay saved for manual answer completion, but cannot appear in a test.
  s.queue = [...s.queue.filter((id) => ids.has(id)), ...shuffle(fresh)];
  s.wrongIds = s.wrongIds.filter((id) => ids.has(id));
  // If a pending test contains questions removed by deduplication, preserve it:
  // a started/ready test must not silently change under the learner.
  if (uniqueQuestions.length === 0) {
    s.queue = [];
    s.pending = null;
  }
  return saveDaily(s);
}

export function setPerDay(n: number): void {
  const s = loadDaily();
  s.perDay = Math.min(MAX_PER_DAY, Math.max(1, Math.round(n) || DEFAULT_PER_DAY));
  saveDaily(s);
}

export function setMinutesPerQuestion(n: number): void {
  const s = loadDaily();
  s.minutesPerQuestion = Math.min(10, Math.max(0, Math.round(n * 10) / 10 || 0));
  saveDaily(s);
}

/** Wipes the bank, the pending test and all progress (the learner's finished attempts stay in Past attempts). */
export function resetDaily(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Non-critical.
  }
}

// ── today's test ─────────────────────────────────────────────────────

export type DailyStatus = 'empty' | 'pending' | 'ready' | 'done';

/**
 * empty   – no questions in the bank yet
 * pending – a test is waiting (today's, or one missed earlier)
 * ready   – a new test can be prepared right now
 * done    – today's test is already submitted; the next one comes tomorrow
 */
export function getDailyStatus(s: DailyTestState = loadDaily()): DailyStatus {
  if (s.pending) return 'pending';
  if (getReadyDailyQuestionCount(s.bank) === 0) return 'empty';
  return s.lastCompletedDate === todayKey() ? 'done' : 'ready';
}

/** Pops the next `count` ids from the queue, starting a new round when it runs out. */
function takeIds(s: DailyTestState, count: number): string[] {
  const readyBank = s.bank.filter(isReadyQuestion);
  const take = Math.min(count, readyBank.length);
  const picked: string[] = [];
  while (picked.length < take) {
    if (s.queue.length === 0) {
      s.round += 1;
      s.queue = newRoundOrder(readyBank, s.wrongIds).filter((id) => !picked.includes(id));
      if (s.queue.length === 0) break; // bank is smaller than `take` and fully used
    }
    picked.push(s.queue.shift() as string);
  }
  return picked;
}

/**
 * The test to take now. Returns the waiting test if there is one; otherwise prepares a fresh one
 * (only if today's has not been submitted yet). Returns null when there is nothing to take.
 */
export function getOrCreateTodayTest(): TestPaper | null {
  const s = loadDaily();
  if (s.pending) return s.pending;
  if (getDailyStatus(s) !== 'ready') return null;

  const ids = takeIds(s, s.perDay);
  const byId = new Map(s.bank.map((q) => [q.id, q]));
  const questions = ids.map((id) => byId.get(id)).filter((q): q is TestQuestion => !!q);
  if (questions.length === 0) return null;

  const now = new Date();
  const date = todayKey(now);
  const mins = s.minutesPerQuestion > 0 ? Math.max(1, Math.round(questions.length * s.minutesPerQuestion)) : 0;
  const paper: TestPaper = {
    id: `${DAILY_PAPER_PREFIX}${date}_${Date.now().toString(36)}`,
    title: `Daily Test · ${now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    topic: 'Daily Test',
    durationMinutes: mins,
    questions,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  s.pending = paper;
  saveDaily(s);
  return paper;
}

export const isDailyPaper = (paperId: string): boolean => paperId.startsWith(DAILY_PAPER_PREFIX);

/** Call when a daily test is submitted: clears the waiting test and remembers which questions were wrong. */
export function completeDailyTest(paperId: string, results: GradedResult[]): void {
  const s = loadDaily();
  if (!s.pending || s.pending.id !== paperId) return;
  const wrong = new Set(s.wrongIds);
  for (const r of results) {
    if (r.isCorrect === false) wrong.add(r.questionId);
    else if (r.isCorrect === true) wrong.delete(r.questionId);
  }
  const inBank = new Set(s.bank.map((q) => q.id));
  s.wrongIds = [...wrong].filter((id) => inBank.has(id));
  s.pending = null;
  s.lastCompletedDate = todayKey();
  s.daysCompleted += 1;
  saveDaily(s);
}

/** For the card/setup screens. */
export function getDailySummary(s: DailyTestState = loadDaily()) {
  return {
    total: getReadyDailyQuestionCount(s.bank),
    perDay: s.perDay,
    left: s.queue.length, // not yet used in this round
    round: s.round,
    daysCompleted: s.daysCompleted,
    wrongCount: s.wrongIds.length,
    daysPerRound: getReadyDailyQuestionCount(s.bank) > 0 ? Math.ceil(getReadyDailyQuestionCount(s.bank) / Math.max(1, s.perDay)) : 0,
  };
}

// ── backup (localStorage is per-browser) ─────────────────────────────

export function exportDailyBackup(): string {
  return JSON.stringify(loadDaily());
}

export function importDailyBackup(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!isState(parsed)) return false;
    return saveDaily({ ...emptyState(), ...parsed });
  } catch {
    return false;
  }
}
