import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/auth.js';
import { tryFetchTranscript, tryFetchTimedTranscript, TRANSCRIPT_CHAR_LIMIT } from './_lib/transcript.js';
import { generateAIText } from './_lib/aiFallback.js';
import { fetchVideoMeta } from './_lib/youtubeMeta.js';
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


// ============================================================
// MODE "timeline" — POST { mode: 'timeline', videoId, title?, description? }
// Response: { segments: [{ start, title, summary }], source: 'chapters' | 'transcript' }
//
// Powers the Focus Player's "Now teaching" card. Lives inside this endpoint
// (not a new file) because the hosting plan caps the number of functions.
//   1. FREE path: the creator's own chapters in the description ("0:00 Intro").
//   2. Otherwise: timed transcript -> AI splits it into concept segments.
// ============================================================
interface Segment {
  start: number;
  title: string;
  summary: string;
}

function parseChapters(description: string): Segment[] {
  const out: Segment[] = [];
  for (const line of description.split(/\r?\n/)) {
    const m = /^\s*(?:[-•*▶►]\s*)?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:|.)]?\s*(.{2,100})$/.exec(line);
    if (!m) continue;
    const start = (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
    out.push({ start, title: m[4].trim(), summary: '' });
  }
  // A real chapter list starts near 0:00, has 3+ entries, and strictly increases.
  if (out.length < 3 || out[0].start > 30) return [];
  for (let i = 1; i < out.length; i++) if (out[i].start <= out[i - 1].start) return [];
  return out.slice(0, 40);
}

const segmentSchema = {
  type: 'OBJECT',
  properties: {
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { start: { type: 'NUMBER' }, title: { type: 'STRING' }, summary: { type: 'STRING' } },
        required: ['start', 'title', 'summary'],
      },
    },
  },
  required: ['segments'],
};

function bucketTranscript(lines: { start: number; text: string }[]): string {
  const rows: string[] = [];
  let bucketStart = -1;
  let buf = '';
  const flush = () => {
    if (buf) rows.push(`[${Math.floor(bucketStart)}s] ${buf.trim()}`);
    buf = '';
  };
  for (const l of lines) {
    if (bucketStart < 0 || l.start - bucketStart >= 30) {
      flush();
      bucketStart = l.start;
    }
    buf += ` ${l.text}`;
  }
  flush();
  return rows.join('\n').slice(0, TRANSCRIPT_CHAR_LIMIT);
}

async function handleTimeline(
  res: VercelResponse,
  videoId: string,
  title: string | undefined,
  description: string | undefined,
  apiKey: string | undefined,
  minimaxApiKey: string | undefined
) {
  // 1) Creator chapters (free). Fetch the description ourselves if the client didn't send it.
  let desc = description ?? '';
  let duration = 0;
  const ytKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
  if ((!desc || !title) && ytKey) {
    const meta = await fetchVideoMeta(videoId, ytKey);
    if (meta) {
      desc = desc || meta.description;
      duration = meta.durationSeconds;
    }
  }
  const chapters = parseChapters(desc);
  if (chapters.length > 0) {
    res.status(200).json({ segments: chapters, source: 'chapters' });
    return;
  }

  // 2) Timed transcript -> AI concept segments.
  const lines = await tryFetchTimedTranscript(videoId);
  if (!lines) {
    res.status(422).json({ error: 'No chapters or captions available for this video.' });
    return;
  }
  const endSec = Math.ceil(lines[lines.length - 1].start);
  const maxSegs = Math.min(30, Math.max(5, Math.round(endSec / 240)));
  const prompt = `Below is a timestamped transcript of a lecture${title ? ` titled "${title}"` : ''}. Each line starts with its start time in seconds, like [95s].

Split the lecture into its TEACHING SEGMENTS: each time the teacher moves to a new concept, rule, example or topic, that is a new segment. Return between 4 and ${maxSegs} segments in order.

For each segment give:
- "start": the start time in seconds (use a time that appears in the transcript, first segment must start at 0)
- "title": the CONCEPT being taught, in simple Hinglish (Hindi+English mix), max 6 words. Name the concept itself (e.g. "Is/Am/Are ka use"), not vague words like "Introduction" or "Discussion".
- "summary": ONE short Hinglish sentence on what the teacher explains in that segment.

Paraphrase, never copy the transcript wording. Return ONLY JSON: {"segments":[{"start":0,"title":"...","summary":"..."}]}

TRANSCRIPT:
${bucketTranscript(lines)}`;

  try {
    const { text } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: segmentSchema, maxOutputTokens: 4000, temperature: 0.3 },
      minimaxJsonMode: true,
      minimaxMaxTokens: 4000,
    });
    const parsed = JSON.parse(text.trim());
    const limit = duration || endSec + 60;
    let prev = -1;
    const segments: Segment[] = (Array.isArray(parsed?.segments) ? parsed.segments : [])
      .map((s: any) => ({
        start: Math.max(0, Math.round(Number(s?.start) || 0)),
        title: String(s?.title ?? '').trim().slice(0, 80),
        summary: String(s?.summary ?? '').trim().slice(0, 200),
      }))
      .filter((s: Segment) => s.title && s.start <= limit)
      .sort((a: Segment, b: Segment) => a.start - b.start)
      .filter((s: Segment) => {
        if (s.start <= prev) return false;
        prev = s.start;
        return true;
      });
    if (segments.length < 2) {
      res.status(422).json({ error: 'Could not build a concept timeline.' });
      return;
    }
    segments[0].start = 0;
    res.status(200).json({ segments, source: 'transcript' });
  } catch (err: any) {
    console.error('timeline failed:', err);
    res.status(500).json({ error: err?.message || 'Timeline generation failed' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await requireUser(req, res);
  if (!uid) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { videoId, title, description, mode } = (req.body ?? {}) as {
    videoId?: string;
    title?: string;
    description?: string;
    mode?: string;
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

  if (mode === 'timeline') {
    await handleTimeline(res, videoId, title, description, apiKey, minimaxApiKey);
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