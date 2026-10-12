// api/_lib/personalityTypes/felder/types.ts
// Felder-Silverman knowledge (from the Growth Gaps PDFs): 4 pairs = 8 types. The PDFs rate the
// evidence as mixed, so the AI treats it as a medium-weight supporting signal.
export interface FelderType {
  pole: 'S' | 'N' | 'V' | 'W' | 'A' | 'R' | 'Q' | 'G';
  label: string;
  coreTrap: string;
  gaps: { gap: string; cause: string; fix: string }[];
}
