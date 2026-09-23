// api/grade-test.ts
//
// Grades the SUBJECTIVE (free-text) answers from a completed Test.tsx
// attempt. MCQs never hit this endpoint — they're graded instantly and
// deterministically client-side (testGrading.ts) by comparing
// selectedIndex to correctIndex, no AI needed.
//
// Free text can't be string-matched against modelAnswer, so this sends
// each question + the learner's answer + the model answer to Gemini and
// asks for a 0-1 score plus one line of feedback per question, keyed by
// questionId so the client can merge results back onto the right question
// regardless of AI response ordering.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';

interface SubjectiveItem {
  questionId: string;
  question: string;
  modelAnswer: string;
  userAnswer: string;
}

const buildPrompt = (topic: string, items: SubjectiveItem[]) => `You are grading short-answer test responses on "${topic}".

For each item below, compare the learner's answer to the model answer and judge whether it demonstrates the SAME understanding — not identical wording. Give partial credit for a partially correct or incomplete-but-not-wrong answer. A blank or "I don't know" answer scores 0.

${items
  .map(
    (it, i) => `Item ${i + 1} (id: "${it.questionId}"):
Question: ${it.question}
Model answer: ${it.modelAnswer}
Learner's answer: ${it.userAnswer || '(left blank)'}`
  )
  .join('\n\n')}

Return ONLY this JSON structure, one entry per item, in any order, using the exact "id" values given above:
{
  "results": [
    { "id": "...", "score": 0.0, "isCorrect": false, "feedback": "one short sentence on what was right/missing" }
  ]
}
Scoring guide: score >= 0.6 means isCorrect should be true; below that, isCorrect should be false.`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          score: { type: 'NUMBER' },
          isCorrect: { type: 'BOOLEAN' },
          feedback: { type: 'STRING' },
        },
        required: ['id', 'score', 'isCorrect', 'feedback'],
      },
    },
  },
  required: ['results'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { topic, items } = (req.body ?? {}) as { topic?: string; items?: SubjectiveItem[] };
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items required (non-empty array)' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  try {
    const { text } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ role: 'user', parts: [{ text: buildPrompt(topic || 'this topic', items) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens: 4000,
        temperature: 0.3, // grading should be consistent, not creative
      },
      minimaxJsonMode: true,
      minimaxMaxTokens: 4000,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    if (!Array.isArray(parsed.results)) {
      return res.status(502).json({ error: 'AI response missing results array' });
    }

    const knownIds = new Set(items.map((it) => it.questionId));
    const results = parsed.results
      .filter((r: any) => r?.id && knownIds.has(r.id))
      .map((r: any) => ({
        questionId: String(r.id),
        score: Math.min(1, Math.max(0, Number(r.score) || 0)),
        isCorrect: !!r.isCorrect,
        feedback: String(r.feedback ?? ''),
      }));

    return res.status(200).json({ results });
  } catch (err: any) {
    console.error('Grade test proxy failed:', err);
    return res.status(500).json({ error: err?.message || 'Grading failed' });
  }
}
