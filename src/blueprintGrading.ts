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
    high: 'Tum fast-paced learner ho — lambi cheezein skim karke seedha essence pakadte ho.',
    mid: 'Tumhara pace balanced hai — na bahut slow, na bahut fast.',
    low: 'Tumhe thorough, slow-paced content chahiye — jaldi mein cheezein miss ho jaati hain.',
  },
  theoryVsPractical: {
    high: 'Tum hands-on seekhte ho — pehle karke dekhna, phir samajhna tumhara style hai.',
    mid: 'Theory aur practical dono ka mix tumhare liye kaam karta hai.',
    low: 'Tumhe pehle solid theory chahiye, uske baad hi practical mein confidence aata hai.',
  },
  structureNeed: {
    high: 'Tumhe clear, step-by-step structure chahiye — flexible/random content confuse karta hai.',
    mid: 'Thoda structure helpful hai, lekin poori rigidity zaroori nahi.',
    low: 'Tum flexible learners ho — structure ki zyada zaroorat nahi padti.',
  },
  depth: {
    high: 'Tumhe root-cause tak jaana pasand hai — surface-level explanation satisfy nahi karta.',
    mid: 'Tum zaroorat ke hisaab se depth mein jaate ho, hamesha nahi.',
    low: 'Surface-level understanding tumhare liye kaafi hai — deep-diving se pace slow hoti hai.',
  },
  languageComplexity: {
    high: 'Technical jargon se tumhe problem nahi — comfortable ho complex vocabulary ke saath.',
    mid: 'Kuch jargon chalta hai, lekin bahut technical language confuse kar sakti hai.',
    low: 'Tumhe simple, everyday language mein samjhaya jaana chahiye — jargon se dooriyan.',
  },
  storytelling: {
    high: 'Real-life stories aur analogies se concepts tumhare mind mein permanently baith jaate hain.',
    mid: 'Stories help karti hain, lekin zaroori nahi har jagah.',
    low: 'Tumhe direct, to-the-point explanation pasand hai — stories se distract ho sakte ho.',
  },
  repetitionNeed: {
    high: 'Tumhe multiple revisions chahiye deep clarity ke liye — ek baar padhna kaafi nahi.',
    mid: 'Thoda revision helpful hota hai, lekin zyada zaroorat nahi.',
    low: 'Ek baar samajh lo to dobara revise karne ki zaroorat kam hi padti hai.',
  },
  priorKnowledgeComfort: {
    high: 'Naye topics ko purani knowledge se connect karke tum jaldi seekhte ho.',
    mid: 'Kabhi kabhi prior knowledge se connect karte ho, hamesha nahi.',
    low: 'Tumhe fresh start pasand hai — purani knowledge se connect karna zaroori nahi lagta.',
  },
};

export function getVerdict(dimensionKey: string, score: number): string {
  const v = VERDICTS[dimensionKey];
  if (!v) return '';
  if (score >= 7) return v.high;
  if (score >= 4) return v.mid;
  return v.low;
}