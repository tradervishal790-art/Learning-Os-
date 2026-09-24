// src/testGrading.ts
//
// Everything here runs on-device, no network call, no AI. MCQs are
// graded the instant the test is submitted (correctIndex is already
// known). Subjective (free-text) questions can't be scored that way, so
// they start "ungraded" (isCorrect: null) and the results screen lets
// the learner compare their answer to their own modelAnswer and pick
// right/wrong themselves — see selfGradeSubjective().
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
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[.,;:!?"\u201c\u201d]/g, '')
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

/** Learner clicks "I got this right" / "I got this wrong" for a subjective question on the results screen. */
export function selfGradeSubjective(results: GradedResult[], questionId: string, isCorrect: boolean, marks: number): GradedResult[] {
  return results.map((r) => (r.questionId === questionId ? { questionId, isCorrect, marksObtained: isCorrect ? marks : 0 } : r));
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
