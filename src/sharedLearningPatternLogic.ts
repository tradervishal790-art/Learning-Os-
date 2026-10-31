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
