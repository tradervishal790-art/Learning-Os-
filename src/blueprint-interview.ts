// api/blueprint-interview.ts
//
// Server-side proxy for the live AI Blueprint Interview (BlueprintInterview.tsx).
// Replaces the static 12-question LearningQuiz with a real Gemini-driven
// conversation: Gemini asks ~10-15 adaptive questions (one at a time,
// follow-up based on prior answers), then closes the interview itself and
// returns a written report + the same 8 LearningProfile dimensions the old
// quiz produced — so every downstream consumer (Roadmap.tsx, PlaylistBuilder.ts,
// queryExpander.ts) keeps working unchanged, since they only read the
// LearningProfile shape, not how it was produced.
//
// Same pattern as api/mentor-chat.ts: key stays server-side, browser only
// ever sends/receives conversation content.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_MODEL = 'gemini-flash-latest';
const MIN_QUESTIONS = 10;
const MAX_QUESTIONS = 15;

interface HistoryMessage {
  role: 'user' | 'model';
  content: string;
}

const SYSTEM_INSTRUCTIONS = `Aap ek AI mentor hain jo ek student ka "Learning Blueprint" banane ke liye live, natural interview le rahe hain — yeh ek static quiz ki jagah hai, isliye conversation asli aur adaptive honi chahiye, robotic nahi.

Aapka goal: in 8 dimensions ko samajhna, student ke apne shabdon aur examples se (direct "1-10 rate karo" jaisa mat poochhna — asli sawaal poochho jinke jawabon se yeh dimensions khud nikal sakein):
- pace (1=slow/thorough, 10=fast/skim)
- theoryVsPractical (1=theory-first, 10=practical/hands-on-first)
- structureNeed (1=flexible okay, 10=needs strict structure)
- depth (1=surface-level okay, 10=needs root-cause depth)
- languageComplexity (1=simple language, 10=technical/jargon comfortable)
- storytelling (1=direct/no-story, 10=needs narrative/analogy)
- repetitionNeed (1=once is enough, 10=needs repeated revision)
- priorKnowledgeComfort (1=needs zero-background start, 10=comfortable connecting to prior knowledge)

Rules:
- Hinglish mein baat karo, casual aur friendly, jaise ek senior dost samjha raha ho.
- EK time pe sirf EK sawaal poochho. Chhota aur specific rakho.
- Har agla sawaal pichhle jawab par based ho — follow-up karo, generic list mat pucho.
- Kam se kam ${MIN_QUESTIONS} sawaal poochho, ${MAX_QUESTIONS} se zyada mat jaana. Jaise hi tumhe saare 8 dimensions ke baare mein confident signal mil jaaye, interview close kar do — zabardasti sawaal mat khींchna.
- Pehla sawaal seedha shuru karo, koi lambi intro mat do.

Response format — HAMESHA sirf valid JSON, koi markdown fence nahi, koi extra text nahi:

Agar interview continue ho raha hai:
{"type":"question","text":"agla sawaal yahan"}

Agar interview complete ho gaya (saari 8 dimensions ka confident signal mil chuka hai):
{"type":"complete","report":"student ke liye ek warm, personal, paragraph-form likha hua report — unki learning style ke baare mein 4-6 sentences, Hinglish mein, jaise ek mentor apne student ko unke baare mein bata raha ho","dimensions":{"pace":N,"theoryVsPractical":N,"structureNeed":N,"depth":N,"languageComplexity":N,"storytelling":N,"repetitionNeed":N,"priorKnowledgeComfort":N},"reliabilityScore":N,"selfReportedHonesty":"honest"}

reliabilityScore (0-100): jawabon ki consistency aur depth ke basis par kitna bharosa kiya jaa sakta hai is profile par.
selfReportedHonesty: "honest" | "partially_honest" | "gamed" | "declined" — agar jawab bahut chhote/generic/evasive lage to "partially_honest" ya "gamed" use karo.`;

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

  const { history } = (req.body ?? {}) as { history?: HistoryMessage[] };
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  // Empty history = kick off the interview with a first question.
  const contents =
    history && history.length > 0
      ? history.map((m) => ({ role: m.role, parts: [{ text: m.content }] }))
      : [{ role: 'user', parts: [{ text: 'Interview shuru karo.' }] }];

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.8 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({
        error: `Interview mein gadbad ho gayi (${geminiRes.status}). Thodi der mein phir try karein. 🔄`,
      });
    }

    const data = await geminiRes.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseGeminiJson(rawText);

    if (!parsed?.type) {
      return res.status(502).json({ error: 'Response samajh nahi aaya, phir se try karein. 🔄' });
    }

    if (parsed.type === 'question' && typeof parsed.text === 'string' && parsed.text.trim()) {
      return res.status(200).json({ type: 'question', text: parsed.text.trim() });
    }

    if (parsed.type === 'complete' && validateComplete(parsed)) {
      return res.status(200).json({
        type: 'complete',
        report: parsed.report.trim(),
        dimensions: parsed.dimensions,
        reliabilityScore:
          typeof parsed.reliabilityScore === 'number'
            ? Math.max(0, Math.min(100, Math.round(parsed.reliabilityScore)))
            : 70,
        selfReportedHonesty: ['honest', 'partially_honest', 'gamed', 'declined'].includes(
          parsed.selfReportedHonesty
        )
          ? parsed.selfReportedHonesty
          : 'honest',
      });
    }

    return res.status(502).json({ error: 'Interview response invalid tha, phir se try karein. 🔄' });
  } catch (err: any) {
    console.error('Blueprint interview proxy failed:', err);
    return res.status(500).json({ error: 'Network error aaya. Internet check karein aur phir try karein. 🔄' });
  }
}