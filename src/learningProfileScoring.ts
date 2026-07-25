import type { LearningProfile, QuizAnswer, QuizAnswerValue } from './types';

// ============================================================
// learningProfileScoring.ts — v3
//
// Each question now has 4 options. Option position does NOT
// correlate with score — 'A' is not always lowest, 'D' is not
// always highest. Each question's option->score mapping is defined
// explicitly below in a scrambled order, so the user can't shortcut
// the quiz by always picking the same letter or visual position.
// ============================================================

export type DimensionKey =
  | 'pace'
  | 'theoryVsPractical'
  | 'structureNeed'
  | 'depth'
  | 'languageComplexity'
  | 'storytelling'
  | 'repetitionNeed'
  | 'priorKnowledgeComfort';

export const QUESTION_SCORE_MAP: Record<string, Record<QuizAnswerValue, number>> = {
  q1_pace: { A: 7, B: 2, C: 9, D: 4 },
  q2_theory_practical: { A: 3, B: 9, C: 6, D: 1 },
  q3_structure: { A: 8, B: 3, C: 5, D: 1 },
  q4_language: { A: 2, B: 8, C: 4, D: 6 },
  q5_repetition: { A: 5, B: 9, C: 2, D: 7 },
  q6_depth: { A: 6, B: 2, C: 9, D: 4 },
  q7_storytelling: { A: 8, B: 3, C: 6, D: 1 },
  q8_prior_knowledge: { A: 4, B: 8, C: 2, D: 6 },
  q9_pace_check: { A: 3, B: 8, C: 5, D: 1 },
  q10_repetition_check: { A: 7, B: 3, C: 9, D: 5 },
  q11_language_check: { A: 6, B: 3, C: 8, D: 1 },
};

const CONSISTENCY_PAIRS: [string, string][] = [
  ['q1_pace', 'q9_pace_check'],
  ['q5_repetition', 'q10_repetition_check'],
  ['q4_language', 'q11_language_check'],
];

function averageDefined(values: (number | null)[]): number {
  const defined = values.filter((v): v is number => v !== null);
  if (defined.length === 0) return 5;
  const sum = defined.reduce((total, v) => total + v, 0);
  return Math.round((sum / defined.length) * 10) / 10;
}

function bandOf(score: number): number {
  if (score < 5) return 0;
  if (score < 7) return 1;
  return 2;
}

export function computeLearningProfile(
  answers: QuizAnswer[],
  honestyAnswer: 'A' | 'B' | 'C' | 'D' | null
): LearningProfile {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.value]));

  const getScore = (questionId: string): number | null => {
    const selected = answerMap.get(questionId);
    const scoreMap = QUESTION_SCORE_MAP[questionId];
    if (!selected || !scoreMap) return null;
    return scoreMap[selected];
  };

  const pace = averageDefined([getScore('q1_pace'), getScore('q9_pace_check')]);
  const languageComplexity = averageDefined([getScore('q4_language'), getScore('q11_language_check')]);
  const repetitionNeed = averageDefined([getScore('q5_repetition'), getScore('q10_repetition_check')]);

  const theoryVsPractical = getScore('q2_theory_practical') ?? 5;
  const structureNeed = getScore('q3_structure') ?? 5;
  const depth = getScore('q6_depth') ?? 5;
  const storytelling = getScore('q7_storytelling') ?? 5;
  const priorKnowledgeComfort = getScore('q8_prior_knowledge') ?? 5;

  let bandAgreementTotal = 0;
  let checkedPairs = 0;

  for (const pair of CONSISTENCY_PAIRS) {
    const primaryScore = getScore(pair[0]);
    const checkScore = getScore(pair[1]);
    if (primaryScore === null || checkScore === null) continue;

    checkedPairs += 1;
    const bandGap = Math.abs(bandOf(primaryScore) - bandOf(checkScore));
    const agreement = bandGap === 0 ? 1 : bandGap === 1 ? 0.5 : 0;
    bandAgreementTotal += agreement;
  }

  const consistencyReliability = checkedPairs > 0 ? (bandAgreementTotal / checkedPairs) * 100 : 100;

  let selfReportedHonesty: LearningProfile['selfReportedHonesty'] = 'honest';
  let honestyPenalty = 0;

  if (honestyAnswer === 'B') {
    selfReportedHonesty = 'partially_honest';
    honestyPenalty = 10;
  } else if (honestyAnswer === 'C') {
    selfReportedHonesty = 'gamed';
    honestyPenalty = 25;
  } else if (honestyAnswer === 'D' || honestyAnswer === null) {
    selfReportedHonesty = 'declined';
    honestyPenalty = 5;
  }

  const reliabilityScore = Math.max(0, Math.round(consistencyReliability - honestyPenalty));

  return {
    pace: pace,
    theoryVsPractical: theoryVsPractical,
    structureNeed: structureNeed,
    depth: depth,
    languageComplexity: languageComplexity,
    storytelling: storytelling,
    repetitionNeed: repetitionNeed,
    priorKnowledgeComfort: priorKnowledgeComfort,
    reliabilityScore: reliabilityScore,
    selfReportedHonesty: selfReportedHonesty,
    completedAt: new Date().toISOString(),
  };
}