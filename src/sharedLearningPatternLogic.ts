export type SharedPatternBucket = 'low' | 'medium' | 'high';

export function bucketRecallRatings(ratings: Array<'forgot' | 'partial' | 'remembered'>): SharedPatternBucket | null {
  if (ratings.length < 2) return null;
  const score = ratings.reduce((sum, rating) => sum + (rating === 'remembered' ? 1 : rating === 'partial' ? 0.5 : 0), 0) / ratings.length;
  return score < 0.4 ? 'low' : score < 0.75 ? 'medium' : 'high';
}

export function bucketQuestionAccuracy(correct: number, scored: number): SharedPatternBucket | null {
  if (!Number.isInteger(correct) || !Number.isInteger(scored) || scored < 10 || correct < 0 || correct > scored) return null;
  const accuracy = correct / scored;
  return accuracy < 0.4 ? 'low' : accuracy < 0.75 ? 'medium' : 'high';
}

export function isSharedPatternId(value: string): boolean {
  return /^revision_day_(1|3|7|15|30|60)$/.test(value)
    || value === 'question_mcq'
    || value === 'question_subjective';
}

export function buildPatternCounters(bucket: SharedPatternBucket) {
  return {
    sampleCount: 1,
    lowCount: bucket === 'low' ? 1 : 0,
    mediumCount: bucket === 'medium' ? 1 : 0,
    highCount: bucket === 'high' ? 1 : 0,
  };
}

export function communityVideoNudge(signal?: { completedRate: number; earlyDropRate: number; sampleCount: number }): number {
  if (!signal || !Number.isInteger(signal.sampleCount) || signal.sampleCount < 10) return 0;
  if (![signal.completedRate, signal.earlyDropRate].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) return 0;
  return Math.max(-1, Math.min(1, (signal.completedRate - signal.earlyDropRate) / 100)) * 0.08;
}

export function isAnsweredQuestionOutcome(
  questionType: 'mcq' | 'subjective',
  answer: { type: string; selectedIndex?: number | null; text?: string } | undefined,
  isCorrect: boolean | null
): boolean {
  if (isCorrect === null || !answer || answer.type !== questionType) return false;
  if (questionType === 'mcq') return typeof answer.selectedIndex === 'number' && Number.isInteger(answer.selectedIndex);
  return typeof answer.text === 'string' && answer.text.trim().length > 0;
}
