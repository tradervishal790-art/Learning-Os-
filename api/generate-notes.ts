// api/generate-notes.ts
//
// Server-side proxy for Deep Notes generation (Notes.tsx). Previously
// the ENTIRE prompt, responseSchema, and Gemini fetch call lived in the
// browser with `import.meta.env.VITE_GEMINI_API_KEY` in the URL — key
// exposed in the shipped bundle. Moved the whole thing server-side.
//
// ── GROUNDING FIX ───────────────────────────────────────────────────────
// Previously notes were generated generically from just the topic name +
// optional title/description videoContext — the model had no idea what
// THIS specific video actually covered, so it invented generic textbook
// content that often didn't match what the learner just watched.
//
// FIX: when the client sends a `videoId`, fetch the real transcript
// (same shared helper analyze-video.ts uses) and use it as the primary
// basis for the prompt. The model is explicitly told to ground every
// section in what the transcript actually covers, not invent generic
// content. Falls back to videoContext metadata, then to topic-only, if
// no transcript is available — same as analyze-video.ts's fallback
// chain, so a missing/failed transcript never blocks note generation,
// it just lowers grounding quality (reported via `notesSource`).
// ─────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';
import { tryFetchTranscript, TRANSCRIPT_CHAR_LIMIT } from './_lib/transcript.js';

type NotesSource = 'transcript' | 'metadata' | 'topic-only';

const buildPrompt = (topic: string, basis: string | undefined, notesSource: NotesSource) => `Generate DEEP, comprehensive study notes for "${topic}" in Hinglish (Hindi + English mix).
${basis ? (notesSource === 'transcript' ? `Video transcript:\n${basis}` : `Video context: ${basis}`) : ''}

${
  notesSource === 'transcript'
    ? `GROUNDING (critical): every section below must be grounded in what THIS video's transcript actually covers — its own examples, its own sequence of explanation, its own analogies. Do NOT invent generic textbook content the transcript doesn't touch. If the transcript covers something narrower than the full topic, keep the notes narrower too rather than padding with unrelated generic material.`
    : notesSource === 'metadata'
      ? `GROUNDING: only the video's title/description are available (no transcript), so favor ACCURACY over invented specifics — where you're inferring rather than certain, keep that section general instead of fabricating precise details that may not match the actual video.`
      : `GROUNDING: no video-specific information is available, so write general, accurate notes on the topic itself rather than inventing details as if they came from a specific video.`
}

ANTI-REPETITION (critical): each of the 15 JSON sections below must add a genuinely NEW angle — do not restate an earlier section in simpler words. If a section has nothing new to add, keep it short rather than padding it with a rephrase of another section.

Focus on:
1. WHY this concept exists (history, problem it solved)
2. DEEP understanding (not surface knowledge)
3. Prerequisites that must be known first
4. Mental models experts use
5. Common misconceptions and why people get confused
6. Real-world applications with specific contexts
7. Critical thinking questions
8. Learning path for mastery (days 1,3,7,15,30)

Return ONLY this JSON structure:
{
  "summary": "1-2 line essence of the topic",
  "concept": "Detailed explanation - why invented, evolution, core principles",
  "prerequisites": "What must be known first - foundational concepts",
  "mentalModel": "How experts think about this - psychological framework",
  "analogy": "Powerful analogy that makes it click",
  "deepExamples": [
    "Example 1 with detailed context and WHY it illustrates the concept",
    "Example 2 showing edge case or complexity",
    "Example 3 with counterexample or when it fails"
  ],
  "stepByStep": [
    "Step 1: Core principle explanation",
    "Step 2: Mechanism and how it works",
    "Step 3: Apply to different contexts",
    "Step 4: Recognize patterns and relationships",
    "Step 5: Build intuition and mental shortcuts"
  ],
  "misconceptions": [
    "Common misconception 1 + WHY people think this + correct understanding",
    "Misconception 2 + root cause of confusion + how to avoid",
    "Misconception 3 + expert perspective"
  ],
  "criticalThinking": [
    "Why is this important? What real problems does it solve?",
    "What breaks or fails when this concept doesn't apply?",
    "How does this connect to related concepts?",
    "What would happen if this didn't exist?"
  ],
  "realWorldApps": [
    "Application 1: Industry/context + exact use case + impact",
    "Application 2: Different field + how it solves problems there",
    "Application 3: Edge case or emerging application"
  ],
  "advancedConcepts": [
    "Advanced concept 1 + how it builds on basics",
    "Related concept 2 + connections",
    "Research frontier 3 + future directions"
  ],
  "exercises": [
    "Exercise 1: Apply concept to new, unseen problem",
    "Exercise 2: Find counterexample or breaking case",
    "Exercise 3: Explain to 10-year-old child",
    "Exercise 4: Compare and contrast with related concept"
  ],
  "deepQuestions": [
    "Why was this concept invented? What specific problem?",
    "What core assumptions does this make?",
    "Can you find situations where this breaks or fails?",
    "How would you explain this to expert in completely different field?",
    "What's the non-obvious insight most people miss?"
  ],
  "learningPath": [
    "Day 1: Deep read - understand WHY (not just WHAT)",
    "Day 3: Apply to 3-4 different real contexts",
    "Day 7: Teach concept to someone else in detail",
    "Day 15: Find advanced applications + edge cases",
    "Day 30: Connect to 5+ related concepts, see the patterns"
  ],
  "keyInsights": [
    "Critical insight 1: The thing that changes how you see everything",
    "Insight 2: The pattern connecting all these ideas",
    "Insight 3: The mindset shift needed for mastery"
  ]
}`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    concept: { type: 'STRING' },
    prerequisites: { type: 'STRING' },
    mentalModel: { type: 'STRING' },
    analogy: { type: 'STRING' },
    deepExamples: { type: 'ARRAY', items: { type: 'STRING' } },
    stepByStep: { type: 'ARRAY', items: { type: 'STRING' } },
    misconceptions: { type: 'ARRAY', items: { type: 'STRING' } },
    criticalThinking: { type: 'ARRAY', items: { type: 'STRING' } },
    realWorldApps: { type: 'ARRAY', items: { type: 'STRING' } },
    advancedConcepts: { type: 'ARRAY', items: { type: 'STRING' } },
    exercises: { type: 'ARRAY', items: { type: 'STRING' } },
    deepQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
    learningPath: { type: 'ARRAY', items: { type: 'STRING' } },
    keyInsights: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'summary', 'concept', 'prerequisites', 'mentalModel', 'analogy',
    'deepExamples', 'stepByStep', 'misconceptions', 'criticalThinking',
    'realWorldApps', 'advancedConcepts', 'exercises', 'deepQuestions',
    'learningPath', 'keyInsights',
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { topic, videoContext, videoId } = (req.body ?? {}) as {
    topic?: string;
    videoContext?: string;
    videoId?: string;
  };
  if (!topic?.trim()) {
    return res.status(400).json({ error: 'topic required' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  // ── Primary path: real transcript (grounds notes in what THIS video
  // actually covers). Falls back to metadata, then topic-only — never
  // blocks note generation, only affects grounding quality. ──────────────
  let basis: string | undefined;
  let notesSource: NotesSource;

  const transcript = videoId ? await tryFetchTranscript(videoId) : null;
  if (transcript) {
    basis = transcript.slice(0, TRANSCRIPT_CHAR_LIMIT);
    notesSource = 'transcript';
  } else if (videoContext?.trim()) {
    basis = videoContext;
    notesSource = 'metadata';
  } else {
    notesSource = 'topic-only';
  }

  try {
    const { text, finishReason } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ role: 'user', parts: [{ text: buildPrompt(topic, basis, notesSource) }] }],
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
      return res.status(502).json({ error: 'Response too long — try simpler topic' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    return res.status(200).json({ topic, notesSource, ...parsed });
  } catch (err: any) {
    console.error('Generate notes proxy failed:', err);
    return res.status(500).json({ error: err?.message || 'Notes generation failed' });
  }
}
