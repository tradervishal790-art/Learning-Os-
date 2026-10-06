import type { MCQQuestion, SubjectiveQuestion, TestPaper } from './types';

// ============================================================
// officialTests.ts
// Curated tests authored by the app owner. Users can TAKE these but
// never edit them — they live in code, not in localStorage/Firestore.
// To add a test: build its questions with mcq()/sub() below, add a
// TestPaper to OFFICIAL_TESTS, and redeploy. While the list is empty,
// the "Official tests" section is hidden in the Test page.
// No cap on the number of questions per test.
// ============================================================

// Default marking for official papers — edit here to change.
const MARKS = 1;
const NEGATIVE_MARKS = 0;

// Answer position is spread evenly (by question number) so the correct
// option is not predictable; options are authored in any order.
export const mcq = (id: string, question: string, options: string[], answer: string, explanation: string): MCQQuestion => {
  const opts = [...options];
  const target = Number(id.replace(/\D/g, '')) % opts.length;
  const cur = opts.indexOf(answer);
  [opts[cur], opts[target]] = [opts[target], opts[cur]];
  return { id, type: 'mcq', question, options: opts, correctIndex: target, explanation, marks: MARKS, negativeMarks: NEGATIVE_MARKS };
};

export const sub = (id: string, question: string, modelAnswer: string, explanation: string, acceptedAnswers?: string[]): SubjectiveQuestion => ({
  id,
  type: 'subjective',
  question,
  modelAnswer,
  explanation,
  marks: MARKS,
  acceptedAnswers: acceptedAnswers ?? [], // official tests auto-grade subjective answers
});

/** Read-only for users — they can take these but never edit or delete them. */
export const OFFICIAL_TESTS: TestPaper[] = [];
