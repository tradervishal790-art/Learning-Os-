// api/_lib/personalityTypes/vark/index.ts
import type { VarkType } from './types.js';
import { Visual } from './Visual.js';
import { Auditory } from './Auditory.js';
import { ReadWrite } from './ReadWrite.js';
import { Kinesthetic } from './Kinesthetic.js';

const ALL: VarkType[] = [Visual, Auditory, ReadWrite, Kinesthetic];

export function getVarkType(letter: string): VarkType | undefined {
  return ALL.find((t) => t.letter === letter);
}
