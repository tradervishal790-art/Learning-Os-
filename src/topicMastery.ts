import type { TestAttempt } from './types';

export interface TopicTestEvidence {
  accuracy: number | null;
  attempts: number;
  gradedQuestions: number;
}

function normalizeTopicName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

/** Use only exact normalized topic matches, so similar chapter names are not conflated. */
export function getTopicTestEvidence(
  topicTitle: string,
  attempts: readonly Pick<TestAttempt, 'topic' | 'results'>[],
): TopicTestEvidence {
  const key = normalizeTopicName(topicTitle);
  if (!key) return { accuracy: null, attempts: 0, gradedQuestions: 0 };
  const recent = attempts.filter((attempt) => normalizeTopicName(attempt.topic) === key).slice(0, 5);
  let correct = 0;
  let incorrect = 0;
  let scoredAttempts = 0;
  for (const attempt of recent) {
    const graded = attempt.results.filter((result) => typeof result.isCorrect === 'boolean');
    if (graded.length === 0) continue;
    scoredAttempts += 1;
    correct += graded.filter((result) => result.isCorrect === true).length;
    incorrect += graded.filter((result) => result.isCorrect === false).length;
  }
  const gradedQuestions = correct + incorrect;
  return {
    accuracy: gradedQuestions > 0 ? Math.round((correct / gradedQuestions) * 100) : null,
    attempts: scoredAttempts,
    gradedQuestions,
  };
}

/** Combine measured recall/test outcomes with the existing roadmap + engagement estimate. */
export function combineTopicMasteryScore(
  engagementScore: number,
  recallScore: number | null,
  testAccuracy: number | null,
  testAttempts: number,
): number {
  const base = Math.max(0, Math.min(100, Number.isFinite(engagementScore) ? engagementScore : 0));
  const recall = recallScore === null ? null : Math.max(0, Math.min(100, recallScore));
  const test = testAccuracy === null ? null : Math.max(0, Math.min(100, testAccuracy));
  if (test === null) return Math.round(recall ?? base);
  if (recall !== null) return Math.round(recall * 0.65 + test * 0.35);
  const confidence = Math.min(0.6, Math.max(0, testAttempts) * 0.2);
  return Math.round(base * (1 - confidence) + test * confidence);
}
