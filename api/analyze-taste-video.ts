import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchVideoMeta } from './_lib/youtubeMeta.js';
import { tryFetchTranscript, TRANSCRIPT_CHAR_LIMIT } from './_lib/transcript.js';
import { scoreTeachingStyle } from './_lib/teachingStyle.js';
import { generateAIText } from './_lib/aiFallback.js';

// ============================================================
// api/analyze-taste-video.ts
//
// POST body: { videoId: string }
// Response:  {
//   videoId, title, durationSeconds,
//   contentProfile: {...8 teaching-style dimensions, same shape as
//                     analyze-video.ts...},
//   analysisSource: 'transcript' | 'metadata-fallback',
//   styleProfile: {...music/editing/pacing...} | null,
//   styleAnalysisError?: string   // present only if styleProfile is null
// }
//
// Part of the "video-taste onboarding" replacing the 12-question quiz as
// the primary onboarding path (BlueprintInterview / LearningQuiz remain —
// this is an alternative, not a replacement). User submits YouTube videos
// they've already fully watched (min 45 min each); this endpoint scores
// ONE such video. The frontend (TasteOnboarding.tsx) calls this once per
// submitted video, then averages contentProfile across all of them into a
// LearningProfile.
//
// ── WHY NO DOWNLOAD/yt-dlp/ffmpeg ───────────────────────────────────────
// This app runs on Vercel serverless functions — no persistent disk, no
// bundled binaries, tight execution limits. Instead of downloading clips,
// we pass the YouTube URL straight to Gemini as a `fileData` part with a
// `videoMetadata` offset range — Gemini fetches and trims the video on
// Google's side. See api/_lib/aiFallback.ts's GeminiPart type.
// ─────────────────────────────────────────────────────────────────────────
//
// ── WHY STYLE ANALYSIS CAN'T USE MINIMAX FALLBACK ───────────────────────
// MiniMax's API is text-only. If Gemini fails on the video call, there is
// no fallback provider — aiFallback.ts's generateAIText() already throws
// clearly in that case (see hasVideoParts() there). We catch that here and
// return styleProfile: null with styleAnalysisError set, WITHOUT failing
// the whole request — contentProfile (transcript-based) is the primary
// signal and works independently.
// ============================================================

const MIN_DURATION_SECONDS = 45 * 60; // 45 minutes — the hard minimum the user set

/** Clamps a [start, end] pair into [0, durationSeconds], skipping degenerate
 *  ranges (end <= start) — defensive only; MIN_DURATION_SECONDS already
 *  guarantees plenty of room for all 3 clips below. */
function clampClip(start: number, end: number, durationSeconds: number): { start: number; end: number } | null {
  const s = Math.max(0, Math.min(start, durationSeconds));
  const e = Math.max(0, Math.min(end, durationSeconds));
  return e > s ? { start: s, end: e } : null;
}

function buildClipOffsets(durationSeconds: number): { start: number; end: number }[] {
  const mid = durationSeconds / 2;
  const candidates = [
    clampClip(0, 45, durationSeconds), // opening
    clampClip(mid - 22, mid + 23, durationSeconds), // middle
    clampClip(durationSeconds - 90, durationSeconds - 45, durationSeconds), // near the end
  ];
  return candidates.filter((c): c is { start: number; end: number } => c !== null);
}

const STYLE_PROMPT = `
Yeh teen clips ek hi video ke alag-alag hisso se hain (shuruaat, beech, aur ant ke paas). Inko dekh-sun kar (audio + visual dono) is video ki PRODUCTION/ENGAGEMENT style batao — content/topic ke baare mein mat likho, sirf style:

Sirf JSON return karo, is exact shape mein, koi extra text/markdown nahi:
{
  "music_presence": boolean,
  "music_energy": "none" | "low" | "medium" | "high",
  "visual_style": "talking-head" | "slides" | "screen-recording" | "animation" | "mixed",
  "cut_frequency": "low" | "medium" | "high",
  "on_screen_text": boolean,
  "pacing_feel": "calm" | "moderate" | "energetic",
  "notes": "1-2 lines, kya cheez engagement ke liye stand out karti hai"
}
`;

async function scoreVideoStyle(
  geminiApiKey: string | undefined,
  videoId: string,
  clips: { start: number; end: number }[]
): Promise<{ profile: any | null; error?: string }> {
  if (!geminiApiKey) return { profile: null, error: 'Gemini API key not configured' };
  if (clips.length === 0) return { profile: null, error: 'No valid clip ranges for this video' };

  const fileUri = `https://www.youtube.com/watch?v=${videoId}`;
  const clipParts = clips.map((c) => ({
    fileData: { fileUri, mimeType: 'video/*' },
    videoMetadata: { startOffset: `${Math.floor(c.start)}s`, endOffset: `${Math.floor(c.end)}s` },
  }));

  try {
    // NOTE: intentionally omit minimaxApiKey — video parts have no text
    // fallback path (see file header). generateAIText() will throw
    // cleanly if Gemini itself fails, which we catch below.
    const { text: rawText } = await generateAIText({
      geminiApiKey,
      contents: [{ parts: [...clipParts, { text: STYLE_PROMPT }] }],
    });
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return { profile: JSON.parse(cleaned) };
  } catch (err: any) {
    return { profile: null, error: err?.message || 'Style analysis failed' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { videoId } = (req.body ?? {}) as { videoId?: string };
  if (!videoId?.trim()) {
    res.status(400).json({ error: 'videoId is required' });
    return;
  }
  const cleanVideoId = videoId.trim();

  const youtubeApiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
  const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;

  if (!youtubeApiKey) {
    res.status(500).json({ error: 'YouTube API key not configured on server' });
    return;
  }
  if (!geminiApiKey && !minimaxApiKey) {
    res.status(500).json({ error: 'No AI provider configured on server' });
    return;
  }

  // ── Step 1: metadata + duration gate ────────────────────────────────
  const meta = await fetchVideoMeta(cleanVideoId, youtubeApiKey);
  if (!meta) {
    res.status(404).json({ error: 'Video not found' });
    return;
  }
  if (meta.durationSeconds < MIN_DURATION_SECONDS) {
    const minutes = Math.floor(meta.durationSeconds / 60);
    res.status(400).json({
      error: `Yeh video sirf ${minutes} min ka hai — kam se kam 45 min ka poora-dekha-hua video chahiye.`,
    });
    return;
  }

  // ── Step 2: content profile (transcript primary, metadata fallback) ──
  const transcript = await tryFetchTranscript(cleanVideoId);
  let contentProfile: any = null;
  let analysisSource: 'transcript' | 'metadata-fallback' = 'transcript';

  if (transcript) {
    contentProfile = await scoreTeachingStyle(geminiApiKey, minimaxApiKey, transcript, 'transcript', TRANSCRIPT_CHAR_LIMIT);
  }
  if (!contentProfile && (meta.title || meta.description)) {
    contentProfile = await scoreTeachingStyle(
      geminiApiKey,
      minimaxApiKey,
      `Title: ${meta.title}\n\nDescription: ${meta.description}`,
      "video's title and description (no transcript was available)",
      TRANSCRIPT_CHAR_LIMIT
    );
    analysisSource = 'metadata-fallback';
  }
  if (!contentProfile) {
    res.status(422).json({ error: `Could not analyze video ${cleanVideoId}: transcript unavailable and metadata-fallback also failed.` });
    return;
  }

  // ── Step 3: style profile (video clips — best-effort, non-fatal) ─────
  const clips = buildClipOffsets(meta.durationSeconds);
  const { profile: styleProfile, error: styleAnalysisError } = await scoreVideoStyle(geminiApiKey, cleanVideoId, clips);

  res.status(200).json({
    videoId: cleanVideoId,
    title: meta.title,
    durationSeconds: meta.durationSeconds,
    contentProfile,
    analysisSource,
    styleProfile,
    ...(styleAnalysisError ? { styleAnalysisError } : {}),
  });
}
