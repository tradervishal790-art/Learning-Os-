// src/testGrading.ts
//
// MCQs are graded instantly and deterministically here (no AI round-trip
// needed — correctIndex is already known). Subjective answers are graded
// server-side (api/grade-test.ts) since free text needs semantic
// comparison against modelAnswer; buildFinalResults() below just merges
// the two result sets back together in question order.
import type { GradedResult, TestQuestion, TestUserAnswer, MCQQuestion, SubjectiveUserAnswer } from './types';

export function gradeMCQAnswer(question: MCQQuestion, answer: TestUserAnswer | undefined): GradedResult {
  const selectedIndex = answer && answer.type === 'mcq' ? answer.selectedIndex : null;
  const isCorrect = selectedIndex !== null && selectedIndex === question.correctIndex;
  return {
    questionId: question.id,
    isCorrect,
    score: isCorrect ? 1 : 0,
    feedback: question.explanation,
  };
}

/** Items to send to api/grade-test.ts — one per subjective question, paired with the learner's text answer. */
export function buildSubjectiveGradingItems(
  questions: TestQuestion[],
  answers: TestUserAnswer[]
): { questionId: string; question: string; modelAnswer: string; userAnswer: string }[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  return questions
    .filter((q): q is Extract<TestQuestion, { type: 'subjective' }> => q.type === 'subjective')
    .map((q) => {
      const a = answerMap.get(q.id) as SubjectiveUserAnswer | undefined;
      return { questionId: q.id, question: q.question, modelAnswer: q.modelAnswer, userAnswer: a?.text.trim() ?? '' };
    });
}

/** Merges instant MCQ grading with AI subjective grading into one ordered, per-question result list. */
export function buildFinalResults(
  questions: TestQuestion[],
  answers: TestUserAnswer[],
  subjectiveResults: GradedResult[]
): GradedResult[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const subjectiveMap = new Map(subjectiveResults.map((r) => [r.questionId, r]));

  return questions.map((q) => {
    if (q.type === 'mcq') {
      return gradeMCQAnswer(q, answerMap.get(q.id));
    }
    return (
      subjectiveMap.get(q.id) ?? {
        questionId: q.id,
        isCorrect: false,
        score: 0,
        feedback: 'Grading unavailable for this answer.',
      }
    );
  });
}

export function computeScorePercent(results: GradedResult[]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.score, 0);
  return Math.round((total / results.length) * 100);
}
