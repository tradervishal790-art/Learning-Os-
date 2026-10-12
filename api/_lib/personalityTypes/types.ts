// api/_lib/personalityTypes/types.ts
// Pre-analysed knowledge for one Big Five score bucket (from the Growth Gaps PDFs).
// One file per trait x bucket; the Personality Check report reads the ACTIVE ones.
export interface PersonalityType {
  trait: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
  bucket: 1 | 2 | 3 | 4 | 5;
  range: string; // score range, 0-100
  label: string;
  push: 'strong' | 'light' | 'minimal'; // how hard the app pushes growth edges for this bucket
  traitMeaning: string;
  coreTrap: string | null; // the one-line illusion behind most gaps (none in the middle bucket)
  gaps: { gap: string; cause: string; fix: string }[];
}
