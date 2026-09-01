// api/_lib/youtubeMeta.ts
//
// Shared YouTube `videos` metadata fetch — extracted from youtube-video.ts
// so api/analyze-taste-video.ts can also get a video's duration (needed to
// enforce the 45-minute-minimum rule and to compute start/middle/end clip
// offsets) without duplicating the fetch + ISO-8601 parsing logic.

export interface VideoMeta {
  title: string;
  description: string;
  /** Raw ISO-8601 duration string from the API, e.g. "PT48M12S". Kept
   *  around for debugging/logging even though callers mostly want the
   *  parsed seconds value below. */
  durationISO: string;
  durationSeconds: number;
}

/** Parses a YouTube API ISO-8601 duration ("PT1H2M3S") into total seconds.
 *  Returns 0 for anything unparseable rather than throwing — callers treat
 *  0 as "duration unknown" and can decide how strict to be about it. */
export function parseISODuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Fetches title + description + duration for a single videoId. Returns
 *  null (never throws) if the video doesn't exist or the API call fails —
 *  callers decide how to surface that (404 vs generic error). */
export async function fetchVideoMeta(videoId: string, apiKey: string): Promise<VideoMeta | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const item = data?.items?.[0];
    const snippet = item?.snippet;
    const durationISO = item?.contentDetails?.duration;
    if (!snippet || !durationISO) return null;

    return {
      title: snippet.title ?? '',
      description: snippet.description ?? '',
      durationISO,
      durationSeconds: parseISODuration(durationISO),
    };
  } catch {
    return null;
  }
}
