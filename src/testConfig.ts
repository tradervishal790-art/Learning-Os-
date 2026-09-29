// src/testConfig.ts
//
// Single source of truth for how many options an MCQ may have.
// An MCQ has between MIN_OPTIONS and MAX_OPTIONS options (2 = true/false
// style, 4 = classic A/B/C/D). Every place that used to assume "exactly 4"
// (builder, bulk import, photo import, AI answer key, validation) reads
// from here instead, so changing the range later is a one-line edit.
import type { MCQQuestion, TestQuestion } from './types';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

/** "A", "B", "C", "D" for option index 0..3. */
export const optionLabel = (index: number): string => String.fromCharCode(65 + index);

export const filledOptionCount = (options: string[]): number => options.filter((o) => o.trim()).length;

/** True when correctIndex points at a real, non-empty option of this MCQ. */
export function hasValidCorrect(q: Pick<MCQQuestion, 'options' | 'correctIndex'>): boolean {
  const i = q.correctIndex;
  return Number.isInteger(i) && i >= 0 && i < q.options.length && !!q.options[i]?.trim();
}

/**
 * Drops empty options from an MCQ and remaps correctIndex to the new position,
 * so a question typed with only 2 or 3 options ends up with exactly those.
 * If the marked-correct option was itself empty, correctIndex becomes -1
 * (i.e. "no answer yet") rather than silently pointing at a different option.
 */
export function compactMcq(q: MCQQuestion): MCQQuestion {
  const options: string[] = [];
  let correctIndex = -1;
  q.options.forEach((o, i) => {
    if (!o.trim()) return;
    if (i === q.correctIndex) correctIndex = options.length;
    options.push(o.trim());
  });
  return { ...q, options, correctIndex };
}

export const compactQuestion = (q: TestQuestion): TestQuestion => (q.type === 'mcq' ? compactMcq(q) : q);
