// api/_lib/personalityTypes/index.ts
// All 25 Big Five bucket files + lookup by trait and bucket.
import type { PersonalityType } from './types.js';
import { openness_1 } from './openness_1.js';
import { openness_2 } from './openness_2.js';
import { openness_3 } from './openness_3.js';
import { openness_4 } from './openness_4.js';
import { openness_5 } from './openness_5.js';
import { conscientiousness_1 } from './conscientiousness_1.js';
import { conscientiousness_2 } from './conscientiousness_2.js';
import { conscientiousness_3 } from './conscientiousness_3.js';
import { conscientiousness_4 } from './conscientiousness_4.js';
import { conscientiousness_5 } from './conscientiousness_5.js';
import { extraversion_1 } from './extraversion_1.js';
import { extraversion_2 } from './extraversion_2.js';
import { extraversion_3 } from './extraversion_3.js';
import { extraversion_4 } from './extraversion_4.js';
import { extraversion_5 } from './extraversion_5.js';
import { agreeableness_1 } from './agreeableness_1.js';
import { agreeableness_2 } from './agreeableness_2.js';
import { agreeableness_3 } from './agreeableness_3.js';
import { agreeableness_4 } from './agreeableness_4.js';
import { agreeableness_5 } from './agreeableness_5.js';
import { neuroticism_1 } from './neuroticism_1.js';
import { neuroticism_2 } from './neuroticism_2.js';
import { neuroticism_3 } from './neuroticism_3.js';
import { neuroticism_4 } from './neuroticism_4.js';
import { neuroticism_5 } from './neuroticism_5.js';

const ALL: PersonalityType[] = [
  openness_1,
  openness_2,
  openness_3,
  openness_4,
  openness_5,
  conscientiousness_1,
  conscientiousness_2,
  conscientiousness_3,
  conscientiousness_4,
  conscientiousness_5,
  extraversion_1,
  extraversion_2,
  extraversion_3,
  extraversion_4,
  extraversion_5,
  agreeableness_1,
  agreeableness_2,
  agreeableness_3,
  agreeableness_4,
  agreeableness_5,
  neuroticism_1,
  neuroticism_2,
  neuroticism_3,
  neuroticism_4,
  neuroticism_5,
];

export function getPersonalityType(trait: string, bucket: number): PersonalityType | undefined {
  return ALL.find((t) => t.trait === trait && t.bucket === bucket);
}
