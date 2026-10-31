// src/testDraft.ts
// Saves an in-progress test locally so refresh/tab close doesn't lose work.
// The clock continues from startedAt, like a real exam.
import type { TestPaper, TestQuestion, TestUserAnswer } from './types';

const KEY = 'learning_os_test_draft';
const QUESTION_STATUSES = new Set(['not-visited', 'not-answered', 'answered', 'marked', 'answered-marked']);

export interface TestDraft {
  paper: TestPaper;
  answers: TestUserAnswer[];
  statusMap: Record<string, string>;
  step: number;
  startedAt: number;
}

function isQuestion(value: unknown): value is TestQuestion {
  if (!value || typeof value !== 'object') return false;
  const q = value as Partial<TestQuestion>;
  if (typeof q.id !== 'string' || !q.id.trim() || typeof q.question !== 'string' || !q.question.trim()) return false;
  if (typeof q.marks !== 'number' || !Number.isFinite(q.marks) || q.marks < 0 || typeof q.explanation !== 'string') return false;
  if (q.type === 'mcq') {
    return Array.isArray(q.options)
      && q.options.length >= 2
      && q.options.every((option) => typeof option === 'string')
      && Number.isInteger(q.correctIndex)
      && (q.correctIndex as number) >= -1
      && (q.correctIndex as number) < q.options.length
      && typeof q.negativeMarks === 'number'
      && Number.isFinite(q.negativeMarks)
      && q.negativeMarks >= 0;
  }
  if (q.type === 'subjective') {
    return typeof q.modelAnswer === 'string'
      && (q.acceptedAnswers === undefined
        || (Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.every((answer) => typeof answer === 'string')));
  }
  return false;
}

function isPaper(value: unknown): value is TestPaper {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<TestPaper>;
  return typeof p.id === 'string' && !!p.id.trim()
    && typeof p.title === 'string' && typeof p.topic === 'string'
    && typeof p.durationMinutes === 'number' && Number.isFinite(p.durationMinutes) && p.durationMinutes >= 0
    && Array.isArray(p.questions) && p.questions.length > 0 && p.questions.every(isQuestion)
    && new Set(p.questions.map((q) => q.id)).size === p.questions.length
    && typeof p.createdAt === 'string' && typeof p.updatedAt === 'string';
}

function isAnswerForPaper(answer: unknown, paper: TestPaper): answer is TestUserAnswer {
  if (!answer || typeof answer !== 'object') return false;
  const a = answer as Partial<TestUserAnswer>;
  const question = paper.questions.find((q) => q.id === a.questionId);
  if (!question) return false;
  if (question.type === 'mcq') {
    return a.type === 'mcq'
      && (a.selectedIndex === null
        || (Number.isInteger(a.selectedIndex) && (a.selectedIndex as number) >= 0 && (a.selectedIndex as number) < question.options.length));
  }
  return a.type === 'subjective' && typeof a.text === 'string';
}

function parseDraft(value: unknown): TestDraft | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Partial<TestDraft>;
  if (!isPaper(d.paper) || !Array.isArray(d.answers) || !d.answers.every((a) => isAnswerForPaper(a, d.paper!))) return null;
  if (new Set(d.answers.map((a) => a.questionId)).size !== d.answers.length) return null;
  if (!d.statusMap || typeof d.statusMap !== 'object' || Array.isArray(d.statusMap)) return null;
  const ids = new Set(d.paper.questions.map((q) => q.id));
  const statusMap: Record<string, string> = {};
  for (const [id, status] of Object.entries(d.statusMap)) {
    if (!ids.has(id) || typeof status !== 'string' || !QUESTION_STATUSES.has(status)) return null;
    statusMap[id] = status;
  }
  if (!Number.isInteger(d.step) || typeof d.step !== 'number') return null;
  if (typeof d.startedAt !== 'number' || !Number.isFinite(d.startedAt) || d.startedAt <= 0) return null;
  return {
    paper: d.paper,
    answers: d.answers,
    statusMap,
    step: Math.max(0, Math.min(d.paper.questions.length - 1, d.step)),
    startedAt: d.startedAt,
  };
}

export function loadDraft(): TestDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = parseDraft(JSON.parse(raw));
    if (!parsed) localStorage.removeItem(KEY);
    return parsed;
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* Best-effort cleanup. */ }
    return null;
  }
}

export function saveDraft(draft: TestDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
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
