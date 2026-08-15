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
    high: 'Aap fast-paced learner hain — lambi cheezein skim karke seedha essence pakadte hain.',
    mid: 'Aapka pace balanced hai — na bahut slow, na bahut fast.',
    low: 'Aapko thorough, slow-paced content chahiye — jaldi mein cheezein miss ho jaati hain.',
  },
  theoryVsPractical: {
    high: 'Aap hands-on seekhte hain — pehle karke dekhna, phir samajhna aapka style hai.',
    mid: 'Theory aur practical dono ka mix aapke liye kaam karta hai.',
    low: 'Aapko pehle solid theory chahiye, uske baad hi practical mein confidence aata hai.',
  },
  structureNeed: {
    high: 'Aapko clear, step-by-step structure chahiye — flexible/random content confuse karta hai.',
    mid: 'Thoda structure helpful hai, lekin poori rigidity zaroori nahi.',
    low: 'Aap flexible learner hain — structure ki zyada zaroorat nahi padti.',
  },
  depth: {
    high: 'Aapko root-cause tak jaana pasand hai — surface-level explanation satisfy nahi karta.',
    mid: 'Aap zaroorat ke hisaab se depth mein jaate hain, hamesha nahi.',
    low: 'Surface-level understanding aapke liye kaafi hai — deep-diving se pace slow hoti hai.',
  },
  languageComplexity: {
    high: 'Technical jargon se aapko problem nahi — comfortable hain complex vocabulary ke saath.',
    mid: 'Kuch jargon chalta hai, lekin bahut technical language confuse kar sakti hai.',
    low: 'Aapko simple, everyday language mein samjhaya jaana chahiye — jargon se dooriyan.',
  },
  storytelling: {
    high: 'Real-life stories aur analogies se concepts aapke mind mein permanently baith jaate hain.',
    mid: 'Stories help karti hain, lekin zaroori nahi har jagah.',
    low: 'Aapko direct, to-the-point explanation pasand hai — stories se distract ho sakte hain.',
  },
  repetitionNeed: {
    high: 'Aapko multiple revisions chahiye deep clarity ke liye — ek baar padhna kaafi nahi.',
    mid: 'Thoda revision helpful hota hai, lekin zyada zaroorat nahi.',
    low: 'Ek baar samajh liya to dobara revise karne ki zaroorat kam hi padti hai.',
  },
  priorKnowledgeComfort: {
    high: 'Naye topics ko purani knowledge se connect karke aap jaldi seekhte hain.',
    mid: 'Kabhi kabhi prior knowledge se connect karte hain, hamesha nahi.',
    low: 'Aapko fresh start pasand hai — purani knowledge se connect karna zaroori nahi lagta.',
  },
};

export function getVerdict(dimensionKey: string, score: number): string {
  const v = VERDICTS[dimensionKey];
  if (!v) return '';
  if (score >= 7) return v.high;
  if (score >= 4) return v.mid;
  return v.low;
}