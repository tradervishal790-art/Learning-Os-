// api/youtube-search.ts
//
// Server-side proxy for YouTube's `search` endpoint.
//
// WHY THIS FILE EXISTS:
// VideoIntel.tsx and conceptVideoPool.ts used to call
// googleapis.com/youtube/v3/search directly from the BROWSER with
// `import.meta.env.VITE_YOUTUBE_API_KEY` appended to the URL. Any VITE_
// prefixed env var gets baked into the client JS bundle at build time —
// so that key was sitting in plain text in the shipped bundle, readable
// by anyone via "View Source" or DevTools > Network tab. That let anyone
// copy the key and burn our YouTube quota (or get it revoked by Google
// for suspicious usage patterns).
//
// This endpoint keeps the key server-side only (process.env, never sent
// to the client) and forwards just the fields the client actually needs.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const { q, maxResults, pageToken, relevanceLanguage } = req.query as {
    q?: string;
    maxResults?: string;
    pageToken?: string;
    relevanceLanguage?: string;
  };

  if (!q?.trim()) {
    return res.status(400).json({ error: 'q (query) required' });
  }

  // Same env var name as before — just read server-side now instead of
  // client-side. Set this in Vercel Project Settings > Environment
  // Variables (NOT prefixed with VITE_ going forward — see note below).
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured on server' });
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: (maxResults && Number(maxResults) > 0 ? maxResults : '12').toString(),
    q: q.trim(),
    key: apiKey,
  });
  if (pageToken) params.set('pageToken', pageToken);
  if (relevanceLanguage) params.set('relevanceLanguage', relevanceLanguage);

  try {
    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const data = await ytRes.json();

    if (!ytRes.ok) {
      console.error('YouTube search error:', ytRes.status, data);
      return res.status(502).json({ error: data?.error?.message || 'YouTube API error' });
    }

    // Forward only the fields client code actually reads — never the raw
    // Google response (keeps payload small, avoids leaking anything extra).
    const items = (data.items ?? []).map((item: any) => ({
      id: { videoId: item.id?.videoId },
      snippet: {
        title: item.snippet?.title,
        description: item.snippet?.description ?? '',
        thumbnails: item.snippet?.thumbnails,
        channelTitle: item.snippet?.channelTitle,
        channelId: item.snippet?.channelId,
      },
    }));

    return res.status(200).json({
      items,
      nextPageToken: data.nextPageToken ?? null,
    });
  } catch (err: any) {
    console.error('YouTube search proxy failed:', err);
    return res.status(500).json({ error: err?.message || 'YouTube search failed' });
  }
}
