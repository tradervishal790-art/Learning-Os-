// src/testAI.ts
//
// The Test feature (Test.tsx, TestBuilder.tsx, testGrading.ts) normally has
// no AI in it at all — Vishal types every question and answer by hand. This
// file adds two OPT-IN AI helpers for the two moments that's not always
// possible:
//
//   1. Building a test but don't have/know the answer key?
//      generateAnswerKey() → api/generate-answer-key.ts asks Gemini to
//      solve the questions itself (MCQ correctIndex or a subjective
//      modelAnswer + a one-line "why"). Only questions still missing an
//      answer are sent; applyAnswerKey() patches them onto the builder's
//      questions without touching ones already filled in.
//
//   2. Taking a test and a subjective answer has no fixed key to
//      auto-match against? checkAnswersWithAI() → api/grade-answer.ts asks
//      Gemini to judge the learner's own written answer (right/wrong + a
//      short note) instead of the learner self-marking it.
//
// Both are plain fetch calls, no auth header — same pattern as
// Mentor.tsx/Research.tsx. Nothing here runs unless the user clicks a
// button for it, so the feature's normal (zero-AI) cost is unchanged.
import type { TestQuestion, MCQQuestion, SubjectiveQuestion } from './types';

// ---------- 1. Answer-key generation ----------

export interface AnswerKeyRequestItem {
  id: string;
  type: 'mcq' | 'subjective';
  question: string;
  options?: string[];
}

export interface AnswerKeyResult {
  id: string;
  correctIndex?: number;
  modelAnswer?: string;
  explanation: string;
}

/** Questions from a builder's list that still need an answer before they can be saved. */
export function findMissingAnswers(questions: TestQuestion[]): TestQuestion[] {
  return questions.filter((q) => (q.type === 'mcq' ? q.correctIndex < 0 || q.correctIndex > 3 : !q.modelAnswer.trim()));
}

export async function generateAnswerKey(items: AnswerKeyRequestItem[]): Promise<AnswerKeyResult[]> {
  if (items.length === 0) return [];
  const response = await fetch('/api/generate-answer-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: items }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Answer key generation failed (${response.status})`);
  return Array.isArray(data.answers) ? data.answers : [];
}

/** Patches AI-generated answers onto builder questions — only where a question is STILL missing one (never overwrites something the author already filled in). */
export function applyAnswerKey(questions: TestQuestion[], results: AnswerKeyResult[]): TestQuestion[] {
  const byId = new Map(results.map((r) => [r.id, r]));
  return questions.map((q) => {
    const r = byId.get(q.id);
    if (!r) return q;
    if (q.type === 'mcq') {
      if (q.correctIndex >= 0 && q.correctIndex <= 3) return q;
      const idx = typeof r.correctIndex === 'number' ? r.correctIndex : -1;
      if (idx < 0 || idx > 3) return q;
      const patched: MCQQuestion = { ...q, correctIndex: idx, explanation: q.explanation || r.explanation };
      return patched;
    }
    if (q.modelAnswer.trim()) return q;
    const patched: SubjectiveQuestion = { ...q, modelAnswer: (r.modelAnswer ?? '').trim(), explanation: q.explanation || r.explanation };
    return patched;
  });
}

// ---------- 2. AI answer checking ----------

export interface AnswerCheckRequestItem {
  id: string;
  question: string;
  modelAnswer?: string;
  userAnswer: string;
  marks: number;
}

export interface AnswerCheckResult {
  id: string;
  isCorrect: boolean;
  feedback: string;
}

export async function checkAnswersWithAI(items: AnswerCheckRequestItem[]): Promise<AnswerCheckResult[]> {
  if (items.length === 0) return [];
  const response = await fetch('/api/grade-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `AI check failed (${response.status})`);
  return Array.isArray(data.results) ? data.results : [];
}
