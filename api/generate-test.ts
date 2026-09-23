// api/generate-test.ts
//
// Server-side proxy for the Test-taking feature (Test.tsx). Same pattern
// as generate-notes.ts — the prompt + Gemini key stay server-side, client
// just sends topic (+ optional counts / video grounding) and gets back a
// parsed, schema-validated question set.
//
// Mix of question types on purpose: MCQs are instantly, deterministically
// gradeable client-side (see testGrading.ts), while subjective questions
// test actual recall/explanation ability that MCQs can't — but need an AI
// grader (api/grade-test.ts) since free text can't be string-matched.
// Every question carries its own `explanation` so the results dashboard
// can show "why" for a wrong MCQ guess just as well as a weak subjective
// answer.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';
import { tryFetchTranscript, TRANSCRIPT_CHAR_LIMIT } from './_lib/transcript.js';

const MIN_COUNT = 1;
const MAX_MCQ = 10;
const MAX_SUBJECTIVE = 6;

const buildPrompt = (topic: string, mcqCount: number, subjectiveCount: number, basis: string | undefined) => `Create a test on "${topic}" to check whether a learner actually understands it (not just recognizes keywords).
${basis ? `Ground the questions in this specific material — don't invent content it doesn't cover:\n${basis}` : ''}

Generate exactly ${mcqCount} multiple-choice (objective) questions and exactly ${subjectiveCount} short-answer (subjective) questions.

MCQ rules:
- Exactly 4 options each, only ONE correct.
- Distractors must be plausible (a common mistake or a half-truth), not obviously wrong filler.
- Vary which option index (0-3) is correct across questions — do NOT always put the answer in the same position.
- "explanation" must say why the correct option is right AND briefly why the main distractor is tempting but wrong.

Subjective rules:
- Ask something that needs a real explanation in the learner's own words (not a one-word/date/fact recall).
- "modelAnswer" is a concise, complete reference answer (2-5 sentences) a grader will compare free-text answers against.
- "explanation" restates the core idea the answer must demonstrate, for the learner to read after grading.

Difficulty should span easy → hard across the set, not be uniformly hard or uniformly trivial.

Return ONLY this JSON structure, nothing else:
{
  "mcq": [
    { "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." }
  ],
  "subjective": [
    { "question": "...", "modelAnswer": "...", "explanation": "..." }
  ]
}`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    mcq: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correctIndex: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
        },
        required: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
    subjective: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          modelAnswer: { type: 'STRING' },
          explanation: { type: 'STRING' },
        },
        required: ['question', 'modelAnswer', 'explanation'],
      },
    },
  },
  required: ['mcq', 'subjective'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { topic, mcqCount, subjectiveCount, videoContext, videoId } = (req.body ?? {}) as {
    topic?: string;
    mcqCount?: number;
    subjectiveCount?: number;
    videoContext?: string;
    videoId?: string;
  };
  if (!topic?.trim()) {
    return res.status(400).json({ error: 'topic required' });
  }

  const mcq = Math.min(MAX_MCQ, Math.max(MIN_COUNT, Math.round(mcqCount ?? 5)));
  const subjective = Math.min(MAX_SUBJECTIVE, Math.max(MIN_COUNT, Math.round(subjectiveCount ?? 3)));

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  let basis: string | undefined;
  const transcript = videoId ? await tryFetchTranscript(videoId) : null;
  if (transcript) {
    basis = transcript.slice(0, TRANSCRIPT_CHAR_LIMIT);
  } else if (videoContext?.trim()) {
    basis = videoContext;
  }

  try {
    const { text, finishReason } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ role: 'user', parts: [{ text: buildPrompt(topic, mcq, subjective, basis) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens: 8000,
        temperature: 0.8,
      },
      minimaxJsonMode: true,
      minimaxMaxTokens: 8000,
    });

    if (finishReason === 'MAX_TOKENS') {
      return res.status(502).json({ error: 'Response too long — try fewer questions' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    if (!Array.isArray(parsed.mcq) || !Array.isArray(parsed.subjective)) {
      return res.status(502).json({ error: 'AI response missing mcq/subjective arrays' });
    }

    let seq = 0;
    const questions = [
      ...parsed.mcq
        .filter((q: any) => q?.question && Array.isArray(q.options) && q.options.length === 4 && typeof q.correctIndex === 'number')
        .map((q: any) => ({
          id: `q${++seq}`,
          type: 'mcq' as const,
          question: String(q.question),
          options: q.options.map((o: any) => String(o)),
          correctIndex: Math.min(3, Math.max(0, Math.round(q.correctIndex))),
          explanation: String(q.explanation ?? ''),
        })),
      ...parsed.subjective
        .filter((q: any) => q?.question && q?.modelAnswer)
        .map((q: any) => ({
          id: `q${++seq}`,
          type: 'subjective' as const,
          question: String(q.question),
          modelAnswer: String(q.modelAnswer),
          explanation: String(q.explanation ?? ''),
        })),
    ];

    if (questions.length === 0) {
      return res.status(502).json({ error: 'No usable questions generated' });
    }

    return res.status(200).json({ topic, questions });
  } catch (err: any) {
    console.error('Generate test proxy failed:', err);
    return res.status(500).json({ error: err?.message || 'Test generation failed' });
  }
}
