// api/_lib/teachingStyle.ts
//
// Shared teaching-style dimension prompt + Gemini scoring — extracted from
// analyze-video.ts unchanged, so api/analyze-taste-video.ts (the new
// video-taste onboarding) can score a video against the exact same 8
// dimensions as candidate-video analysis and the LearningProfile blueprint
// interview, without duplicating the prompt/parsing logic.

import { generateAIText } from './aiFallback.js';

export const DIMENSION_PROMPT = (basis: string, sourceLabel: string, charLimit: number) => `
Is ${sourceLabel} ko analyze karke teacher ka teaching-style profile do, in dimensions par 1-10 scale mein score karo:

1. pace (1=very slow/detailed, 10=fast/dense)
2. theory_vs_practical (1=pure theory, 10=pure hands-on/examples)
3. structure (1=freeform/tangential, 10=highly structured/stepwise)
4. depth (1=surface overview, 10=deep technical rigor)
5. language_complexity (1=simple everyday words, 10=jargon-heavy)
6. storytelling (1=dry facts, 10=analogy/story-driven)
7. repetition (1=says once, 10=repeats/reinforces concepts often)
8. prerequisite_assumed (1=zero background needed, 10=assumes strong prior knowledge)

Ye bhi do:
- primary_style: [visual/verbal/example-driven/socratic/lecture]
- ideal_for: kis tarah ke learner ke liye best fit hai (2-3 lines)
- avoid_for: kis tarah ke learner ko struggle ho sakti hai
- connector_facts: is content se 3-6 chhote factual anchors (specific terms/concepts/ideas jo koi AGLA topic build kar sakta hai) — is transcript ko dobara kabhi nahi bhejna padega, isliye yahi extract kar do abhi

Sirf JSON return karo, koi extra text nahi, koi markdown backticks nahi.

Content:
${basis.slice(0, charLimit)}
`;

/** Scores a text basis (transcript, or title+description fallback) against
 *  the 8 teaching-style dimensions via Gemini (MiniMax fallback included).
 *  Returns null on any failure — caller decides what to try next. */
export async function scoreTeachingStyle(
  apiKey: string | undefined,
  minimaxApiKey: string | undefined,
  basis: string,
  sourceLabel: string,
  charLimit: number
): Promise<any | null> {
  try {
    const { text: rawText } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ parts: [{ text: DIMENSION_PROMPT(basis, sourceLabel, charLimit) }] }],
      minimaxJsonMode: true,
    });

    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
