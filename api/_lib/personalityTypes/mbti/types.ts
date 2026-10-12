// api/_lib/personalityTypes/mbti/types.ts
// MBTI type knowledge (from the Growth Gaps PDFs). A FRIENDLY LABEL only: it never drives
// scoring or growth-edge logic; the Big Five buckets and behaviour data do.
export interface MbtiType {
  type: string; // e.g. "INTJ"
  coreTrap: string;
  gaps: { gap: string; cause: string; fix: string }[];
}
