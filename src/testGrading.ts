// src/testGrading.ts
//
// MCQs are graded the instant the test is submitted (correctIndex is
// already known) — fully on-device, no network call. Subjective
// (free-text) questions can't be scored that deterministically, so they
// start "ungraded" (isCorrect: null) and the results screen lets the
// learner either compare their answer to their own modelAnswer and pick
// right/wrong themselves (selfGradeSubjective(), no AI, no network), or —
// opt-in, see testAI.ts / api/grade-answer.ts — have Gemini judge the
// answer instead and pass a short feedback string through this same
// function.
import type { GradedResult, TestQuestion, TestUserAnswer, MCQQuestion, SubjectiveQuestion, SubjectiveUserAnswer } from './types';

export function gradeMCQAnswer(question: MCQQuestion, answer: TestUserAnswer | undefined): GradedResult {
  const selectedIndex = answer && answer.type === 'mcq' ? answer.selectedIndex : null;
  if (selectedIndex === null) {
    return { questionId: question.id, isCorrect: false, marksObtained: 0 }; // unattempted — no negative marking
  }
  const isCorrect = selectedIndex === question.correctIndex;
  return {
    questionId: question.id,
    isCorrect,
    marksObtained: isCorrect ? question.marks : -question.negativeMarks,
  };
}

export function normalizeAnswer(text: string): string {
  // Language-neutral: NFC-normalise (so Hindi/other scripts compare reliably), lowercase
  // (no-op for scripts without case), drop common punctuation incl. the Devanagari danda.
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[.,;:!?"\u201c\u201d\u0964\u0965]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Auto-grades a subjective answer against modelAnswer + acceptedAnswers (used for official tests). */
export function gradeSubjectiveLocally(question: SubjectiveQuestion, answer: TestUserAnswer | undefined): GradedResult {
  const text = answer && answer.type === 'subjective' ? answer.text : '';
  const accepted = [question.modelAnswer, ...(question.acceptedAnswers ?? [])].map(normalizeAnswer);
  const isCorrect = text.trim().length > 0 && accepted.includes(normalizeAnswer(text));
  return { questionId: question.id, isCorrect, marksObtained: isCorrect ? question.marks : 0 };
}

/** Builds the initial result set right after submit: MCQs fully graded; subjective auto-graded when the question defines acceptedAnswers, otherwise left ungraded (isCorrect: null) for the learner to self-mark on the results screen. */
export function buildInitialResults(questions: TestQuestion[], answers: TestUserAnswer[]): GradedResult[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  return questions.map((q) =>
    q.type === 'mcq'
      ? gradeMCQAnswer(q, answerMap.get(q.id))
      : q.acceptedAnswers
        ? gradeSubjectiveLocally(q, answerMap.get(q.id))
        : { questionId: q.id, isCorrect: null, marksObtained: 0 }
  );
}

/** Learner clicks "I got this right" / "I got this wrong" for a subjective question on the results screen — or an AI check (api/grade-answer.ts) supplies the same verdict plus a short `feedback` note. */
export function selfGradeSubjective(results: GradedResult[], questionId: string, isCorrect: boolean, marks: number, feedback?: string): GradedResult[] {
  return results.map((r) => (r.questionId === questionId ? { questionId, isCorrect, marksObtained: isCorrect ? marks : 0, feedback } : r));
}

/** Folds several AI-graded results (api/grade-answer.ts, one batched call) into the result set in a single pass — used instead of calling selfGradeSubjective in a loop so each verdict doesn't get built from a stale snapshot of `results`. */
export function applyAIGradeBatch(
  results: GradedResult[],
  questions: TestQuestion[],
  graded: { id: string; isCorrect: boolean; feedback: string }[]
): GradedResult[] {
  const marksById = new Map(questions.map((q) => [q.id, q.marks]));
  let next = results;
  for (const g of graded) {
    const marks = marksById.get(g.id);
    if (marks === undefined) continue;
    next = selfGradeSubjective(next, g.id, g.isCorrect, marks, g.feedback);
  }
  return next;
}

export function computeTotalMarks(questions: TestQuestion[]): number {
  return questions.reduce((sum, q) => sum + q.marks, 0);
}

export function computeObtainedMarks(results: GradedResult[]): number {
  return results.reduce((sum, r) => sum + r.marksObtained, 0);
}

export function computeScorePercent(obtainedMarks: number, totalMarks: number): number {
  if (totalMarks <= 0) return 0;
  return Math.max(0, Math.round((obtainedMarks / totalMarks) * 100));
}

export function pendingSelfGradeCount(results: GradedResult[]): number {
  return results.filter((r) => r.isCorrect === null).length;
}

export function isMCQAnswered(answer: TestUserAnswer | undefined): boolean {
  return !!answer && answer.type === 'mcq' && answer.selectedIndex !== null;
}

export function isSubjectiveAnswered(answer: TestUserAnswer | undefined): boolean {
  return !!answer && answer.type === 'subjective' && (answer as SubjectiveUserAnswer).text.trim().length > 0;
}

export function isAnswered(answer: TestUserAnswer | undefined): boolean {
  return isMCQAnswered(answer) || isSubjectiveAnswered(answer);
}
