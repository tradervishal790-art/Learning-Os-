// src/blueprintGrading.ts
//
// Converts a raw 1-10 dimension score into a LifeQuest-style grade badge
// (S/A/B/C/D) plus a short one-line verdict. Kept dimension-specific
// because "high pace" and "high depth" mean opposite things in plain
// English — a generic "9/10 = excellent" label would be misleading.
//
// Verdict text lives in translations.ts (t.blueprintVerdicts.<dimension>)
// — getVerdict takes `t` in since this is a plain module, not a component.
import type { TranslationShape } from './i18n/translations';

export interface Grade {
  letter: 'S' | 'A' | 'B' | 'C' | 'D';
  colorClass: string; // Tailwind text/bg color pair, dark-mode aware
}

export function getGrade(score: number): Grade {
  if (score >= 9) return { letter: 'S', colorClass: 'text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/10 border-purple-300/40 dark:border-purple-500/30' };
  if (score >= 7) return { letter: 'A', colorClass: 'text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/10 border-blue-300/40 dark:border-blue-500/30' };
  if (score >= 5) return { letter: 'B', colorClass: 'text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300/40 dark:border-emerald-500/30' };
  if (score >= 3) return { letter: 'C', colorClass: 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/10 border-amber-300/40 dark:border-amber-500/30' };
  return { letter: 'D', colorClass: 'text-gray-600 dark:text-white/60 bg-gray-100 dark:bg-white/5 border-gray-300/40 dark:border-white/10' };
}

export function getVerdict(
  dimensionKey: keyof TranslationShape['blueprintVerdicts'] | string,
  score: number,
  blueprintVerdicts: TranslationShape['blueprintVerdicts']
): string {
  const v = (blueprintVerdicts as Record<string, { high: string; mid: string; low: string }>)[dimensionKey];
  if (!v) return '';
  if (score >= 7) return v.high;
  if (score >= 4) return v.mid;
  return v.low;
}