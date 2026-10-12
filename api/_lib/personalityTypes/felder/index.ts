// api/_lib/personalityTypes/felder/index.ts
import type { FelderType } from './types.js';
import { Sensing } from './Sensing.js';
import { Intuitive } from './Intuitive.js';
import { Visual } from './Visual.js';
import { Verbal } from './Verbal.js';
import { Active } from './Active.js';
import { Reflective } from './Reflective.js';
import { Sequential } from './Sequential.js';
import { Global } from './Global.js';

const ALL: FelderType[] = [Sensing, Intuitive, Visual, Verbal, Active, Reflective, Sequential, Global];

export function getFelderType(pole: string): FelderType | undefined {
  return ALL.find((t) => t.pole === pole);
}
