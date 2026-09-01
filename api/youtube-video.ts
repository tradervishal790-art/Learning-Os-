// api/youtube-video.ts
//
// Server-side proxy for YouTube's `videos` endpoint (fetches title +
// description for a single videoId). Used by Notes.tsx when the user
// pastes a raw YouTube URL to generate Deep Notes from it.
//
// Same reasoning as api/youtube-search.ts — the key must never reach
// the browser bundle.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchVideoMeta } from './_lib/youtubeMeta.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const { id } = req.query as { id?: string };
  if (!id?.trim()) {
    return res.status(400).json({ error: 'id (videoId) required' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured on server' });
  }

  try {
    const meta = await fetchVideoMeta(id.trim(), apiKey);
    if (!meta) {
      return res.status(404).json({ error: 'Video not found' });
    }

    return res.status(200).json({
      title: meta.title,
      description: meta.description,
      // New — additive, existing callers (Notes.tsx) just ignore these.
      durationSeconds: meta.durationSeconds,
    });
  } catch (err: any) {
    console.error('YouTube video-meta proxy failed:', err);
    return res.status(500).json({ error: err?.message || 'YouTube video-meta failed' });
  }
}
