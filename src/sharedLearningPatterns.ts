import { doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getRecallRecords } from './revisionRecallStore';
import type { TestAttempt } from './types';
import { bucketQuestionAccuracy, bucketRecallRatings, buildPatternCounters, isAnsweredQuestionOutcome, isSharedPatternId, type SharedPatternBucket } from './sharedLearningPatternLogic';
import { isSharedLearningEnabled } from './sharedLearningIntelligence';

const MINIMUM_VISIBLE_COHORT = 10;

export interface SharedPatternSummary {
  sampleCount: number;
  lowCount: number;
  mediumCount: number;
  highCount: number;
  lowRate: number;
  mediumRate: number;
  highRate: number;
}

function isRealAccount(): boolean {
  return !!auth.currentUser && !auth.currentUser.isAnonymous;
}

async function contributePattern(signalId: string, bucket: SharedPatternBucket): Promise<boolean> {
  if (!isSharedLearningEnabled() || !isRealAccount() || !isSharedPatternId(signalId)) return false;
  const uid = auth.currentUser!.uid;
  const marker = doc(db, 'users', uid, 'learningPatterns', signalId);
  const aggregate = doc(db, 'shared_learning_patterns', signalId);
  const counters = buildPatternCounters(bucket);
  try {
    const batch = writeBatch(db);
    batch.set(marker, { bucket, submittedAt: serverTimestamp() });
    batch.set(aggregate, {
      ...Object.fromEntries(Object.entries(counters).map(([key, value]) => [key, increment(value)])),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    return true;
  } catch {
    return false;
  }
}

/** One contribution per account and revision interval; only coarse self-recall ratings are used. */
export async function contributeRevisionPattern(day: number): Promise<boolean> {
  if (![1, 3, 7, 15, 30, 60].includes(day)) return false;
  const ratings = getRecallRecords().filter((record) => record.day === day).map((record) => record.rating);
  const bucket = bucketRecallRatings(ratings);
  return bucket ? contributePattern(`revision_day_${day}`, bucket) : false;
}

/** Shares only a broad accuracy band after 10+ scored questions; no question text, answer, or topic is sent. */
export async function contributeQuestionPatterns(attempts: TestAttempt[]): Promise<void> {
  for (const type of ['mcq', 'subjective'] as const) {
    let correct = 0;
    let scored = 0;
    for (const attempt of attempts) {
      const questionMap = new Map(attempt.questions.map((question) => [question.id, question]));
      const answerMap = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
      for (const result of attempt.results) {
        const question = questionMap.get(result.questionId);
        if (!question || question.type !== type) continue;
        if (!isAnsweredQuestionOutcome(type, answerMap.get(result.questionId), result.isCorrect)) continue;
        scored += 1;
        if (result.isCorrect) correct += 1;
      }
    }
    const bucket = bucketQuestionAccuracy(correct, scored);
    if (bucket) await contributePattern(`question_${type}`, bucket);
  }
}

export async function getSharedPatternSummary(signalId: string): Promise<SharedPatternSummary | null> {
  if (!auth.currentUser || !isSharedPatternId(signalId)) return null;
  try {
    const snapshot = await getDoc(doc(db, 'shared_learning_patterns', signalId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    const sampleCount = Number(data.sampleCount);
    if (!Number.isInteger(sampleCount) || sampleCount < MINIMUM_VISIBLE_COHORT) return null;
    const safeCount = (key: string) => {
      const value = Number(data[key]);
      return Number.isInteger(value) && value >= 0 && value <= sampleCount ? value : 0;
    };
    const lowCount = safeCount('lowCount');
    const mediumCount = safeCount('mediumCount');
    const highCount = safeCount('highCount');
    return {
      sampleCount, lowCount, mediumCount, highCount,
      lowRate: Math.round(lowCount / sampleCount * 100),
      mediumRate: Math.round(mediumCount / sampleCount * 100),
      highRate: Math.round(highCount / sampleCount * 100),
    };
  } catch {
    return null;
  }
}
