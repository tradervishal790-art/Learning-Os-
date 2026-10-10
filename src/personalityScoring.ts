// src/personalityScoring.ts
//
// Pure scoring for the 20-question Big Five screen (personalityQuestions.ts).
// - Trait total = sum of the 4 option scores (4..16)
// - Trait score (0-100) = (total - 4) / 12 * 100
// - 5 buckets (0-20, 21-40, 41-60, 61-80, 81-100) for app logic; learners are
//   shown only 3 ZONES (lower / middle / higher) until behaviour confirms them.
// - Consistency check: if the two paired answers of a trait differ by 3
//   (a 1 and a 4), that trait is "unsure" -> shown as middle, behaviour decides.
// - 3+ unsure traits -> suggest retaking another day.
import {
  PERSONALITY_QUESTIONS,
  CONSISTENCY_PAIRS,
  TRAITS,
  type AgeVersion,
  type OptionKey,
  type Trait,
} from './personalityQuestions';

export type Bucket = 1 | 2 | 3 | 4 | 5; // 1 = 0-20 ... 5 = 81-100
export type Zone = 'lower' | 'middle' | 'higher';

export interface TraitResult {
  score: number; // 0-100
  bucket: Bucket;
  /** Neighbouring bucket to blend with when the score is within 3 points of a boundary. */
  blendWith?: Bucket;
  zone: Zone;
  /** The two paired answers disagreed strongly — treat as middle, let behaviour decide. */
  unsure: boolean;
}

export interface PersonalityReport {
  archetype: string;
  dominantArea: string; // area label, e.g. "Curiosity"
  growthArea: string;
  traitNotes: Record<string, string>; // area label -> one sentence
  report: string; // markdown (Core Identity, Learning Style, Pressure & Feelings, Top Strengths, Growth Edges, Study Blueprint)
}

export interface PersonalityProfile {
  version: AgeVersion;
  completedAt: string;
  /** question id -> chosen option key (kept so the result can be re-scored later). */
  answers: Record<string, OptionKey>;
  traits: Record<Trait, TraitResult>;
  retakeSuggested: boolean;
  /** AI-written report, saved after the learner asks for it (cleared on retake). */
  report?: PersonalityReport;
}

const BUCKET_EDGES = [20, 40, 60, 80]; // upper edge of buckets 1..4

export function bucketOf(score: number): Bucket {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

export function zoneOf(score: number): Zone {
  if (score <= 33) return 'lower';
  if (score <= 66) return 'middle';
  return 'higher';
}

function blendOf(score: number, bucket: Bucket): Bucket | undefined {
  for (let i = 0; i < BUCKET_EDGES.length; i++) {
    const edge = BUCKET_EDGES[i];
    if (Math.abs(score - edge) <= 3 || Math.abs(score - (edge + 1)) <= 3) {
      const lower = (i + 1) as Bucket;
      const upper = (i + 2) as Bucket;
      if (bucket === lower) return upper;
      if (bucket === upper) return lower;
    }
  }
  return undefined;
}

function optionScore(questionId: string, key: OptionKey): number {
  const q = PERSONALITY_QUESTIONS.find((x) => x.id === questionId);
  return q?.options.find((o) => o.key === key)?.score ?? 0;
}

export function scorePersonality(version: AgeVersion, answers: Record<string, OptionKey>): PersonalityProfile {
  const traits = {} as Record<Trait, TraitResult>;
  let unsureCount = 0;

  for (const trait of TRAITS) {
    const ids = PERSONALITY_QUESTIONS.filter((q) => q.trait === trait).map((q) => q.id);
    const total = ids.reduce((sum, id) => sum + (answers[id] ? optionScore(id, answers[id]) : 0), 0);
    const score = Math.round(((total - 4) / 12) * 100);

    const [a, b] = CONSISTENCY_PAIRS[trait];
    const unsure =
      !!answers[a] && !!answers[b] && Math.abs(optionScore(a, answers[a]) - optionScore(b, answers[b])) >= 3;
    if (unsure) unsureCount++;

    const bucket = bucketOf(score);
    traits[trait] = {
      score,
      bucket,
      blendWith: blendOf(score, bucket),
      zone: unsure ? 'middle' : zoneOf(score),
      unsure,
    };
  }

  return {
    version,
    completedAt: new Date().toISOString(),
    answers,
    traits,
    retakeSuggested: unsureCount >= 3,
  };
}
