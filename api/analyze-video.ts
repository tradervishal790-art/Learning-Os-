import type { VercelRequest, VercelResponse } from '@vercel/node';
import { tryFetchTranscript, TRANSCRIPT_CHAR_LIMIT } from './_lib/transcript.js';
import { scoreTeachingStyle } from './_lib/teachingStyle.js';

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


// scoreWithGemini here is scoreTeachingStyle from _lib/teachingStyle.ts,
// pinned to this endpoint's existing TRANSCRIPT_CHAR_LIMIT — kept as a
// local alias so the rest of this file (and its callers below) didn't
// need to change at all during the extraction.
const scoreWithGemini = (
  apiKey: string | undefined,
  minimaxApiKey: string | undefined,
  basis: string,
  sourceLabel: string
) => scoreTeachingStyle(apiKey, minimaxApiKey, basis, sourceLabel, TRANSCRIPT_CHAR_LIMIT);

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