import type { LearningProfile } from './types';

// ============================================================
// deepDiveScoring.ts
//
// Converts the optional conversational deep-dive (3 open-ended
// Q&A with Gemini) into partial dimension signals that get
// BLENDED into the existing quiz-derived LearningProfile —
// never overwrite it outright. See mergeLearningProfile() in
// learningProfileStore.ts for the blend logic.
// ============================================================

export type DimensionKey =
  | 'pace'
  | 'theoryVsPractical'
  | 'structureNeed'
  | 'depth'
  | 'languageComplexity'
  | 'storytelling'
  | 'repetitionNeed'
  | 'priorKnowledgeComfort';

export type DeepDiveSignals = Partial<Record<DimensionKey, number>>;

export const DEEP_DIVE_QUESTIONS = [
  'Tell me about a recent topic you had trouble understanding — what exactly was the problem?',
  'When a concept really "clicks" for you, what does that moment feel like? Give an example.',
  "Say you're starting a completely new subject tomorrow that you know nothing about — what's the very first step you'd take?",
] as const;

const DIMENSION_KEYS: DimensionKey[] = [
  'pace',
  'theoryVsPractical',
  'structureNeed',
  'depth',
  'languageComplexity',
  'storytelling',
  'repetitionNeed',
  'priorKnowledgeComfort',
];

export function buildExtractionPrompt(qaPairs: { question: string; answer: string }[]): string {
  const transcript = qaPairs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n');

  return `Below are a student's 3 open-ended answers about their learning style.

${transcript}

Based on these answers, rate this student on these 8 dimensions on a 1-10 scale (1 = one extreme, 10 = the other extreme):

- pace (1=slow/thorough, 10=fast/skim)
- theoryVsPractical (1=theory-first, 10=practical/hands-on-first)
- structureNeed (1=flexible/unstructured okay, 10=needs strict structure)
- depth (1=surface-level okay, 10=needs root-cause depth)
- languageComplexity (1=simple language, 10=technical/jargon comfortable)
- storytelling (1=direct/no-story, 10=needs narrative/analogy)
- repetitionNeed (1=once is enough, 10=needs repeated revision)
- priorKnowledgeComfort (1=needs zero-background start, 10=comfortable connecting to prior knowledge)

Return only JSON, no extra text, no markdown fence. Exact format:
{"pace":N,"theoryVsPractical":N,"structureNeed":N,"depth":N,"languageComplexity":N,"storytelling":N,"repetitionNeed":N,"priorKnowledgeComfort":N}`;
}

/** Parses Gemini's JSON response into validated DeepDiveSignals. Returns null if unparseable/invalid. */
export function parseDeepDiveResponse(rawText: string): DeepDiveSignals | null {
  try {
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const signals: DeepDiveSignals = {};
    for (const key of DIMENSION_KEYS) {
      const val = parsed[key];
      if (typeof val === 'number' && val >= 1 && val <= 10) {
        signals[key] = Math.round(val);
      }
    }
    // Require at least half the dimensions to trust this response
    return Object.keys(signals).length >= 4 ? signals : null;
  } catch {
    return null;
  }
}

export type { LearningProfile };