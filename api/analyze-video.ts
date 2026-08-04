import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

// ============================================================
// api/analyze-video.ts
//
// POST body: { videoId: string }
// Response:  { profile: {...teacher dimensions...}, transcriptLength: number }
//
// This runs server-side (Vercel serverless function) because:
// 1. YouTube transcript fetching gets CORS-blocked from the browser
// 2. Keeps the Gemini API key off the client bundle
//
// Setup needed:
//   npm install youtube-transcript
//   npm install -D @vercel/node
//   Add VITE_GEMINI_API_KEY in Vercel Project Settings → Environment
//   Variables (the .env.local value is NOT deployed automatically)
// ============================================================

const TRANSCRIPT_CHAR_LIMIT = 8000;

const ANALYSIS_PROMPT = (transcript: string) => `
Is transcript ko analyze karke teacher ka teaching-style profile do, in dimensions par 1-10 scale mein score karo:

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

Sirf JSON return karo, koi extra text nahi, koi markdown backticks nahi.

Transcript:
${transcript.slice(0, TRANSCRIPT_CHAR_LIMIT)}
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { videoId } = (req.body ?? {}) as { videoId?: string };
  if (!videoId) {
    res.status(400).json({ error: 'videoId is required' });
    return;
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Gemini API key not configured on server (VITE_GEMINI_API_KEY missing)' });
    return;
  }

  // 1. Fetch transcript — try Hindi/English first, fall back to whatever is available
  let transcriptText = '';
  try {
    let chunks;
    try {
      chunks = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'hi' });
    } catch {
      chunks = await YoutubeTranscript.fetchTranscript(videoId);
    }
    transcriptText = chunks.map((c) => c.text).join(' ');
  } catch (err: any) {
    res.status(422).json({
      error: 'Could not fetch transcript for this video. Subtitles may be disabled.',
      detail: err?.message,
    });
    return;
  }

  if (!transcriptText || transcriptText.length < 50) {
    res.status(422).json({ error: 'Transcript too short or empty for this video' });
    return;
  }

  // 2. Send to Gemini
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: ANALYSIS_PROMPT(transcriptText) }] }],
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      res.status(502).json({ error: 'Gemini API error', detail: geminiData });
      return;
    }

    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let profile: unknown;
    try {
      profile = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'Gemini returned non-JSON response', raw: rawText });
      return;
    }

    res.status(200).json({ profile, transcriptLength: transcriptText.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to analyze video' });
  }
}