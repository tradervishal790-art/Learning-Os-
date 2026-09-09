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
//
// ── SCHEMA (10 fields, not 15) ───────────────────────────────────────────
// Previously had 15 fields with real semantic overlap: concept +
// mentalModel + analogy were three separate takes on "explain this idea",
// and exercises + criticalThinking + deepQuestions were three separate
// takes on "things to actively practice". Merged into coreConcept (one
// cohesive explanation) and practice (one mixed list of do-exercises +
// think-questions) respectively — fewer sections, each with a genuinely
// distinct job, instead of the same idea generated three slightly
// different ways.
// ─────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';
import { tryFetchTranscript, TRANSCRIPT_CHAR_LIMIT } from './_lib/transcript.js';
import { languageInstruction } from './_lib/language.js';

type NotesSource = 'transcript' | 'metadata' | 'topic-only';

const buildPrompt = (topic: string, basis: string | undefined, notesSource: NotesSource, language: string | undefined) => `Generate DEEP, comprehensive study notes for "${topic}".
${languageInstruction(language)}
${basis ? (notesSource === 'transcript' ? `Video transcript:\n${basis}` : `Video context: ${basis}`) : ''}

${
  notesSource === 'transcript'
    ? `GROUNDING (critical): every section below must be grounded in what THIS video's transcript actually covers — its own examples, its own sequence of explanation, its own analogies. Do NOT invent generic textbook content the transcript doesn't touch. If the transcript covers something narrower than the full topic, keep the notes narrower too rather than padding with unrelated generic material.`
    : notesSource === 'metadata'
      ? `GROUNDING: only the video's title/description are available (no transcript), so favor ACCURACY over invented specifics — where you're inferring rather than certain, keep that section general instead of fabricating precise details that may not match the actual video.`
      : `GROUNDING: no video-specific information is available, so write general, accurate notes on the topic itself rather than inventing details as if they came from a specific video.`
}

ANTI-REPETITION (critical): each of the 10 JSON sections below must add a genuinely NEW angle — do not restate an earlier section in simpler words. If a section has nothing new to add, keep it short rather than padding it with a rephrase of another section.

Return ONLY this JSON structure:
{
  "summary": "1-2 line essence of the topic",
  "myNotes": "${
    notesSource === 'transcript'
      ? `Write this section as a clear, well-structured explainer — the way a sharp teacher writes notes to actually make a student understand, not a compressed diary.

FORMAT (critical — decide per part of the content, do NOT force one shape throughout):
- Sequential/step-by-step content (a process, a sequence of stages, "first this then that") → a numbered list: lines starting "1. ", "2. ", "3. ".
- Related grouped points with no strict order (a set of properties, factors, types) → a bullet list: lines starting "- ", with the key term of each point in **bold** at the start of that line.
- A simple flowing explanation that doesn't split naturally into a list → a short paragraph (2-4 sentences).
Mix these freely — each part of the video gets whichever shape genuinely fits it, not the same shape repeated everywhere.

Do NOT use "##" or "###" or any markdown header syntax anywhere — headers are not supported by the renderer and are the main source of broken output. To mark a topic shift, bold the first few words of that part's opening line instead of using a header.

Cover the ENTIRE video start to end, following its own order — do NOT stop after the intro; if it covers many sub-topics, give each its own paragraph/list with at least 2-4 lines, so the notes represent the whole video, not just the first part. Paraphrase in your own simple words, never copy the transcript's wording. Bold (**text**) the 3-8 key terms that matter most across the whole section. Add 1-2 short 'Q:' (question to revisit) or 'Note:' (gotcha/reminder) callouts where genuinely useful, not as decoration. End with a short recap: a line with just **Quick Recap:** (bold, no header syntax) followed by 2-4 bullet points covering the video's full span. No filler intro like 'In this video...' — start directly with the content. Separate every line with a real newline character — never output the literal two characters backslash-n as visible text, and never collapse everything into one continuous paragraph.`
      : `No transcript available for this video, so write general well-structured study notes on the topic itself — same format rules as above (numbered lists for sequences, bullets + bold key term for grouped points, short paragraphs for flowing explanation, bold text instead of any headers, real newlines between lines) — rather than pretending they're from a specific video.`
  }",
  "coreConcept": "ONE cohesive explanation covering: WHY this concept exists (history, problem it solved), HOW experts mentally model it, AND a concrete analogy that makes it click — woven together as one flowing explanation, not three disconnected paragraphs",
  "workedExamples": [
    "Step-by-step mechanism illustrated through a concrete example - how it actually works, walked through",
    "A second example showing a different context or application of the same mechanism",
    "An edge case or counterexample - where/how this breaks or behaves unexpectedly"
  ],
  "misconceptions": [
    "Common misconception 1 + WHY people think this + correct understanding",
    "Misconception 2 + root cause of confusion + how to avoid",
    "Misconception 3 + expert perspective"
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
  "practice": [
    "Exercise: Apply the concept to a new, unseen problem",
    "Exercise: Find a counterexample or breaking case",
    "Question to wrestle with: a critical-thinking question that tests real understanding, not recall",
    "Question to wrestle with: what would happen if this didn't exist, or what core assumption does it make",
    "Exercise: Explain this to a 10-year-old, or compare/contrast it with a related concept"
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
    myNotes: { type: 'STRING' },
    coreConcept: { type: 'STRING' },
    workedExamples: { type: 'ARRAY', items: { type: 'STRING' } },
    misconceptions: { type: 'ARRAY', items: { type: 'STRING' } },
    realWorldApps: { type: 'ARRAY', items: { type: 'STRING' } },
    advancedConcepts: { type: 'ARRAY', items: { type: 'STRING' } },
    practice: { type: 'ARRAY', items: { type: 'STRING' } },
    learningPath: { type: 'ARRAY', items: { type: 'STRING' } },
    keyInsights: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'summary', 'myNotes', 'coreConcept', 'workedExamples',
    'misconceptions', 'realWorldApps', 'advancedConcepts', 'practice',
    'learningPath', 'keyInsights',
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { topic, videoContext, videoId, language } = (req.body ?? {}) as {
    topic?: string;
    videoContext?: string;
    videoId?: string;
    language?: string;
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
      contents: [{ role: 'user', parts: [{ text: buildPrompt(topic, basis, notesSource, language) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens: 12000,
        temperature: 0.8,
      },
      minimaxJsonMode: true,
      minimaxMaxTokens: 12000,
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
