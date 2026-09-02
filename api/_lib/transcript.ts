import { YoutubeTranscript } from 'youtube-transcript';

// ============================================================
// api/_lib/transcript.ts
//
// Shared YouTube transcript fetch helper. Originally lived inline inside
// api/analyze-video.ts; extracted here so api/generate-notes.ts (Deep
// Notes) can also ground its output in the real transcript instead of
// generating generically from just the video title/description.
//
// Uses the unofficial `youtube-transcript` package, which scrapes YouTube
// directly — captions can be disabled, or the fetch can fail/rate-limit.
// tryFetchTranscript() NEVER throws; it returns null on any failure so
// every caller can fall back to metadata instead of erroring out.
// ============================================================

// 150000 chars (~37.5k tokens) covers a 2.5-3 hour lecture-speed video —
// more than enough for virtually anything real, while staying well under
// Gemini's free-tier 250K tokens/minute budget (see aiFallback.ts) and
// keeping a single call's latency reasonable against Vercel's function
// timeout (see vercel.json — these routes are bumped to 60s, but a huge
// input still adds real risk of tipping over that).
export const TRANSCRIPT_CHAR_LIMIT = 150000;
const MIN_TRANSCRIPT_LENGTH = 50;

/** Fetches and flattens a transcript. Returns null (never throws) on any
 *  failure — caller decides what to do next (fall back to metadata). */
export async function tryFetchTranscript(videoId: string): Promise<string | null> {
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
