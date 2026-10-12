// api/_lib/personalityTypes/vark/types.ts
// VARK type knowledge (from the Growth Gaps PDFs). Evidence tier 2: it says how a learner
// likes CONTENT, never what they are; the fixes add practice beyond the preferred style.
export interface VarkType {
  letter: 'V' | 'A' | 'R' | 'K';
  label: string;
  coreTrap: string;
  gaps: { gap: string; cause: string; fix: string }[];
}
