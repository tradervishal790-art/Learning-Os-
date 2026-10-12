// api/_lib/personalityTypes/kolb/index.ts
import type { KolbType } from './types.js';
import { Diverging } from './Diverging.js';
import { Assimilating } from './Assimilating.js';
import { Converging } from './Converging.js';
import { Accommodating } from './Accommodating.js';

const ALL: KolbType[] = [Diverging, Assimilating, Converging, Accommodating];

export function getKolbType(label: string): KolbType | undefined {
  return ALL.find((t) => t.label === label);
}
