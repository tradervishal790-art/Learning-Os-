// api/blueprint-interview.ts
//
// v2 — token-efficient rewrite.
// Old version: Gemini asked one question at a time live (10-15 sequential
// calls per interview). New version: questions come from a static bank
// (src/blueprintQuestions.ts), answered entirely client-side with ZERO
// Gemini calls, then bundled into ONE single Gemini call at the end that
// deeply analyzes all answers together and extracts all 8 dimensions —
// including cross-checking pairs of questions that target the same
// dimension from different angles, to catch inconsistent/gamed answers.
//
// Downstream consumers are unaffected: this still returns the same
// {report, dimensions, reliabilityScore, selfReportedHonesty} shape that
// maps onto LearningProfile, same as before.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback';

interface AnswerPayload {
  questionId: string;
  question: string;
  selectedOption: string; // the option text the user picked
}

const DIMENSION_KEYS = [
  'pace',
  'theoryVsPractical',
  'structureNeed',
  'depth',
  'languageComplexity',
  'storytelling',
  'repetitionNeed',
  'priorKnowledgeComfort',
] as const;

const SYSTEM_INSTRUCTIONS = `Tum ek expert learning-psychology analyst ho. Tumhe ek student ke 11 multiple-choice answers diye jaayenge (poora question + jo option unhone chuna). Tumhara kaam hai in answers ko DEEPLY cross-analyze karke in 8 dimensions ko 1-10 scale par accurately nikalna:

- pace (1=slow/thorough, 10=fast/skim)
- theoryVsPractical (1=theory-first, 10=practical/hands-on-first)
- structureNeed (1=flexible okay, 10=needs strict structure)
- depth (1=surface-level okay, 10=needs root-cause depth)
- languageComplexity (1=simple language chahiye, 10=technical/jargon comfortable)
- storytelling (1=direct/no-story pasand, 10=needs narrative/analogy)
- repetitionNeed (1=once is enough, 10=needs repeated revision)
- priorKnowledgeComfort (1=needs zero-background start, 10=comfortable connecting to prior knowledge)

CRITICAL — cross-validation: Kuch questions jaanbujh kar ek hi dimension ko do baar, alag angle se test karte hain (jaise Q5 aur Q9 dono storytelling ko chhoote hain; Q5 aur Q10 dono repetitionNeed ko; Q4 aur Q11 dono priorKnowledgeComfort ko). Agar in pairs ke jawab EK-DOOSRE SE CONTRADICT karte hain (jaise Q5 mein storytelling pasand bola but Q9 mein clearly reject kiya), toh:
1. Us dimension ka final score in dono jawabon ke beech ka weighted-realistic estimate rakho, extreme value mat do.
2. reliabilityScore ko neeche lao (jitni zyada contradictions utna kam score).
3. selfReportedHonesty ko "partially_honest" ya "gamed" set karo agar multiple contradictions hain.

Agar sab jawab consistent hain toh reliabilityScore high (80-100) rakho aur selfReportedHonesty "honest" rakho.

Sirf answers ke actual content se dimensions nikaalo — options ka surface keyword mat dekho, actual meaning/intent samjho.

TONE — report likhte waqt hamesha respectful "aap" form use karo (jaise "aap", "aapka", "aapko"). Informal "tum", "tera", "tu" bilkul use mat karo.

Response — SIRF valid JSON, koi markdown fence nahi, koi extra text nahi:
{"report":"student ke liye ek warm, personal, paragraph-form likha hua report — 4-6 sentences, Hinglish mein, jaise ek mentor apne student ko unke baare mein bata raha ho, jisme unki learning style ke key traits mention ho","dimensions":{"pace":N,"theoryVsPractical":N,"structureNeed":N,"depth":N,"languageComplexity":N,"storytelling":N,"repetitionNeed":N,"priorKnowledgeComfort":N},"reliabilityScore":N,"selfReportedHonesty":"honest"}`;

function parseGeminiJson(rawText: string): any | null {
  try {
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function validateComplete(parsed: any): boolean {
  if (!parsed?.dimensions || typeof parsed.report !== 'string' || !parsed.report.trim()) return false;
  for (const key of DIMENSION_KEYS) {
    const val = parsed.dimensions[key];
    if (typeof val !== 'number' || val < 1 || val > 10) return false;
  }
  return true;
}



export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { answers } = (req.body ?? {}) as { answers?: AnswerPayload[] };
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers array required' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  const answersBlock = answers
    .map((a, i) => `${i + 1}. Q: ${a.question}\n   Chosen: ${a.selectedOption}`)
    .join('\n\n');

  try {
    const { text: rawText, finishReason: rawFinishReason } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      systemInstruction: SYSTEM_INSTRUCTIONS,
      contents: [{ role: 'user', parts: [{ text: `Student ke jawab:\n\n${answersBlock}` }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.6,
        thinkingConfig: { thinkingBudget: 0 },
      },
      minimaxJsonMode: true,
      minimaxMaxTokens: 2048,
    });

    const finishReason = rawFinishReason ?? 'UNKNOWN';
    const parsed = parseGeminiJson(rawText);

    if (!validateComplete(parsed)) {
      console.error(
        'Blueprint analysis: unparseable/incomplete Gemini response.',
        'finishReason:', finishReason,
        'rawText:', rawText.slice(0, 2000),
      );
      const truncated = finishReason === 'MAX_TOKENS';
      return res.status(502).json({
        error: truncated
          ? 'Response bahut lamba ho gaya tha (cut off). Phir se try karein. 🔄'
          : 'Response samajh nahi aaya, phir se try karein. 🔄',
      });
    }

    return res.status(200).json({
      report: parsed.report.trim(),
      dimensions: parsed.dimensions,
      reliabilityScore:
        typeof parsed.reliabilityScore === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.reliabilityScore)))
          : 70,
      selfReportedHonesty: ['honest', 'partially_honest', 'gamed', 'declined'].includes(parsed.selfReportedHonesty)
        ? parsed.selfReportedHonesty
        : 'honest',
    });
  } catch (err: any) {
    console.error('Blueprint analysis proxy failed:', err);
    return res.status(500).json({ error: 'Network error aaya. Internet check karein aur phir try karein. 🔄' });
  }
}