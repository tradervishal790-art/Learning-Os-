// src/blueprintGrading.ts
//
// Converts a raw 1-10 dimension score into a LifeQuest-style grade badge
// (S/A/B/C/D) plus a short one-line verdict. Kept dimension-specific
// because "high pace" and "high depth" mean opposite things in plain
// English — a generic "9/10 = excellent" label would be misleading.

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

const VERDICTS: Record<string, { high: string; mid: string; low: string }> = {
  pace: {
    high: "You're a fast-paced learner — you skim through long material and go straight for the essence.",
    mid: 'Your pace is balanced — not too slow, not too fast.',
    low: 'You need thorough, slow-paced content — moving too fast makes you miss things.',
  },
  theoryVsPractical: {
    high: 'You learn hands-on — doing it first, then understanding, is your style.',
    mid: 'A mix of theory and practical works for you.',
    low: 'You need solid theory first — confidence in the practical only comes after that.',
  },
  structureNeed: {
    high: 'You need clear, step-by-step structure — flexible/random content confuses you.',
    mid: "A bit of structure helps, but full rigidity isn't necessary.",
    low: "You're a flexible learner — structure isn't really needed.",
  },
  depth: {
    high: "You like to get to the root cause — surface-level explanations don't satisfy you.",
    mid: 'You go deep when needed, not always.',
    low: 'Surface-level understanding is enough for you — deep-diving slows down your pace.',
  },
  languageComplexity: {
    high: "Technical jargon doesn't bother you — you're comfortable with complex vocabulary.",
    mid: 'Some jargon is fine, but very technical language can confuse you.',
    low: 'You need things explained in simple, everyday language — jargon should be kept at a distance.',
  },
  storytelling: {
    high: 'Real-life stories and analogies make concepts stick permanently in your mind.',
    mid: "Stories help, but aren't necessary everywhere.",
    low: 'You prefer direct, to-the-point explanations — stories can distract you.',
  },
  repetitionNeed: {
    high: "You need multiple revisions for deep clarity — reading it once isn't enough.",
    mid: "Some revision helps, but you don't need a lot of it.",
    low: 'Once you understand something, you rarely need to revise it again.',
  },
  priorKnowledgeComfort: {
    high: 'You learn quickly by connecting new topics to what you already know.',
    mid: 'You sometimes connect to prior knowledge, not always.',
    low: "You prefer a fresh start — connecting to prior knowledge doesn't feel necessary.",
  },
};

export function getVerdict(dimensionKey: string, score: number): string {
  const v = VERDICTS[dimensionKey];
  if (!v) return '';
  if (score >= 7) return v.high;
  if (score >= 4) return v.mid;
  return v.low;
}