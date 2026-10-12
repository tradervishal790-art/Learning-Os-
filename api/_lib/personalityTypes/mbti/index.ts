// api/_lib/personalityTypes/mbti/index.ts
// All 16 MBTI files + a label derived from the Big Five buckets (no extra test needed).
import type { MbtiType } from './types.js';
import { INTJ } from './INTJ.js';
import { INTP } from './INTP.js';
import { ENTJ } from './ENTJ.js';
import { ENTP } from './ENTP.js';
import { INFJ } from './INFJ.js';
import { INFP } from './INFP.js';
import { ENFJ } from './ENFJ.js';
import { ENFP } from './ENFP.js';
import { ISTJ } from './ISTJ.js';
import { ISFJ } from './ISFJ.js';
import { ESTJ } from './ESTJ.js';
import { ESFJ } from './ESFJ.js';
import { ISTP } from './ISTP.js';
import { ISFP } from './ISFP.js';
import { ESTP } from './ESTP.js';
import { ESFP } from './ESFP.js';

const ALL: MbtiType[] = [INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP];

/**
 * Closest MBTI label(s) from the final Big Five buckets (1-5 each):
 *   E/I from Extraversion, N/S from Openness, F/T from Agreeableness, J/P from Conscientiousness.
 * Bucket 3 (middle) is unclear. One unclear letter -> both candidates; two or more -> no label.
 */
export function mbtiCandidates(buckets: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }): MbtiType[] {
  const pick = (bucket: number, high: string, low: string): string[] => (bucket >= 4 ? [high] : bucket <= 2 ? [low] : [high, low]);
  const letters = [
    pick(buckets.extraversion, 'E', 'I'),
    pick(buckets.openness, 'N', 'S'),
    pick(buckets.agreeableness, 'F', 'T'),
    pick(buckets.conscientiousness, 'J', 'P'),
  ];
  if (letters.filter((l) => l.length > 1).length > 1) return [];
  let combos: string[] = [''];
  for (const l of letters) combos = combos.flatMap((c) => l.map((x) => c + x));
  return combos.flatMap((c) => ALL.filter((t) => t.type === c));
}
