import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';
import { generateAIText } from './_lib/aiFallback.js';
const TRANSCRIPT_CHAR_LIMIT = 8000;
const MIN_TRANSCRIPT_LENGTH = 50;

// ============================================================
// api/analyze-video.ts
//
// POST body: { videoId: string, title?: string, description?: string }
// Response:  { profile: {...teacher dimensions...}, analysisSource: "transcript" | "metadata-fallback" }
//
// ── FAILURE MODE (previously the #1 bug in this system) ────────────────
// Transcript fetching via the unofficial `youtube-transcript` package
// scrapes YouTube directly. Vercel's datacenter IPs get rate-limited, and
// many videos simply have captions disabled. Previously, this function
// returned an error the moment transcript fetch failed, which caused
// conceptVideoPool.ts to silently drop that candidate — and if EVERY
// candidate's transcript failed, the user saw a false "no videos found"
// even though search worked fine.
//
// FIX: transcript is the PRIMARY path. If it fails for any reason, fall
// back to a lightweight Gemini prompt that infers the same teaching-style
// profile from TITLE + DESCRIPTION only (lower confidence, still usable).
// Only return a genuine error if BOTH paths fail. Response always reports
// which path was used so failures stay diagnosable, not silent.
// ─────────────────────────────────────────────────────────────────────────
//
// Env var used: VITE_GEMINI_API_KEY — same key as api/expand-query.ts.
// Do not confuse with VITE_YOUTUBE_API_KEY (different service, different key).
// ============================================================


const DIMENSION_PROMPT = (basis: string, sourceLabel: string) => `
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

Sirf JSON return karo, koi extra text nahi, koi markdown backticks nahi.

Content:
${basis.slice(0, TRANSCRIPT_CHAR_LIMIT)}
`;

/** Fetches and flattens a transcript. Returns null (never throws) on any
 *  failure — caller decides what to do next (fall back to metadata). */
async function tryFetchTranscript(videoId: string): Promise<string | null> {
  try {
    let chunks;
    try {
      chunks = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'hi' });
    } catch {
      chunks = await YoutubeTranscript.fetchTranscript(videoId);
    }
    const text = chunks.map((c) => c.text).join(' ');
    return text.trim().length >= MIN_TRANSCRIPT_LENGTH ? text : null;
  } catch {
    return null;
  }
}

async function scoreWithGemini(
  apiKey: string | undefined,
  minimaxApiKey: string | undefined,
  basis: string,
  sourceLabel: string
): Promise<any | null> {
  try {
    const { text: rawText } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ parts: [{ text: DIMENSION_PROMPT(basis, sourceLabel) }] }],
      minimaxJsonMode: true,
    });

    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { videoId, title, description } = (req.body ?? {}) as {
    videoId?: string;
    title?: string;
    description?: string;
  };

  if (!videoId) {
    res.status(400).json({ error: 'videoId is required' });
    return;
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
    return;
  }

  // ── Primary path: transcript ──────────────────────────────────────────
  const transcript = await tryFetchTranscript(videoId);
  let profile: any = null;
  let analysisSource: 'transcript' | 'metadata-fallback' = 'transcript';

  if (transcript) {
    profile = await scoreWithGemini(apiKey, minimaxApiKey, transcript, 'transcript');
  }

  // ── Fallback path: title + description ────────────────────────────────
  // Triggered whenever transcript fetch failed OR transcript scoring failed.
  // Never silently drop the candidate — always attempt this before giving up.
  if (!profile) {
    const metadataBasis = `Title: ${title ?? ''}\n\nDescription: ${description ?? ''}`;
    if ((title || description)) {
      profile = await scoreWithGemini(
        apiKey,
        minimaxApiKey,
        metadataBasis,
        "video's title and description (no transcript was available)"
      );
      analysisSource = 'metadata-fallback';
    }
  }

  if (!profile) {
    // Both paths failed — this is the only legitimate case to report failure
    // for this videoId. The caller (conceptVideoPool.ts) should drop just
    // this one video and continue with the rest, not treat this as "no
    // candidates at all."
    res.status(422).json({
      error: `Could not analyze video ${videoId}: transcript unavailable and metadata-fallback also failed.`,
    });
    return;
  }

  res.status(200).json({ profile, analysisSource });
}