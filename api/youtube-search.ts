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
//
// SHORTS FILTERING:
// YouTube's search API has no direct "exclude Shorts" flag, and its
// videoDuration enum ("short" / "medium" / "long") doesn't line up with
// a 3-minute cutoff. So we over-fetch search results, batch-fetch their
// real durations via videos.list (contentDetails.duration), and drop
// anything under 3 minutes before returning to the client.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MIN_DURATION_SECONDS = 180; // 3 minutes — drops YouTube Shorts

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

  // Over-fetch — some results will be dropped as sub-3-min Shorts, so
  // requesting exactly the client's target count would leave it short.
  // YouTube search caps maxResults at 50 per call.
  const requestedCount = maxResults && Number(maxResults) > 0 ? Number(maxResults) : 12;
  const overFetchCount = Math.min(requestedCount * 2, 50);

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: overFetchCount.toString(),
    q: q.trim(),
    key: apiKey,
  });
  if (pageToken) searchParams.set('pageToken', pageToken);
  if (relevanceLanguage) searchParams.set('relevanceLanguage', relevanceLanguage);

  try {
    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
    const data = await ytRes.json();

    if (!ytRes.ok) {
      console.error('YouTube search error:', ytRes.status, data);
      return res.status(502).json({ error: data?.error?.message || 'YouTube API error' });
    }

    const rawItems = data.items ?? [];
    const videoIds = rawItems.map((item: any) => item.id?.videoId).filter(Boolean);

    let durationById = new Map<string, number>();
    if (videoIds.length > 0) {
      const durationParams = new URLSearchParams({
        part: 'contentDetails',
        id: videoIds.join(','),
        key: apiKey,
      });
      const durRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${durationParams.toString()}`);
      const durData = await durRes.json();

      if (durRes.ok) {
        durationById = new Map(
          (durData.items ?? []).map((v: any) => [v.id, parseISO8601Duration(v.contentDetails?.duration)])
        );
      } else {
        // Duration lookup failing shouldn't break search entirely — fall
        // back to returning results unfiltered rather than erroring out.
        console.error('YouTube videos.list error:', durRes.status, durData);
      }
    }

    const filtered =
      durationById.size > 0
        ? rawItems.filter((item: any) => {
            const seconds = durationById.get(item.id?.videoId);
            return typeof seconds === 'number' && seconds >= MIN_DURATION_SECONDS;
          })
        : rawItems;

    // Forward only the fields client code actually reads — never the raw
    // Google response (keeps payload small, avoids leaking anything extra).
    const items = filtered.slice(0, requestedCount).map((item: any) => ({
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

// Parses YouTube's ISO 8601 duration format (e.g. "PT1M30S", "PT15M") into seconds.
function parseISO8601Duration(duration?: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}
