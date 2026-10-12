// api/_lib/personalityTypes/kolb/types.ts
// Kolb learning-style knowledge (from the Growth Gaps PDFs). The PDFs rate the evidence as
// mixed, so the AI treats it as a medium-weight supporting signal.
export interface KolbType {
  label: 'Diverging' | 'Assimilating' | 'Converging' | 'Accommodating';
  coreTrap: string;
  gaps: { gap: string; cause: string; fix: string }[];
}
