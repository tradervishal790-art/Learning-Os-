import { authFetch } from './apiFetch';
import { pullSharedTimeline, pushSharedTimeline } from './sharedVideoCache';
import { cacheGet, cacheSet } from './mediaCache';

// ============================================================
// conceptTimeline.ts — "which concept is the teacher teaching right now?"
// Cache layers: device -> shared Firestore -> /api/analyze-video (mode: timeline).
// A video's timeline is the same for everyone, so it is generated ONCE for all users.
// ============================================================

export interface ConceptSegment {
  start: number; // seconds
  title: string;
  summary: string;
}

const TTL = 7 * 24 * 60 * 60 * 1000;

function clean(raw: unknown): ConceptSegment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => ({
      start: Math.max(0, Number(s?.start) || 0),
      title: typeof s?.title === 'string' ? s.title : '',
      summary: typeof s?.summary === 'string' ? s.summary : '',
    }))
    .filter((s) => s.title)
    .sort((a, b) => a.start - b.start);
}

export interface TimelineResult {
  segments: ConceptSegment[] | null;
  /** Why it is unavailable (shown in small text so problems are diagnosable). */
  reason?: string;
}

/** Returns the timeline, or segments:null when none could be built for this video. */
export async function loadTimeline(videoId: string, title: string): Promise<TimelineResult> {
  const local = clean(cacheGet<ConceptSegment[]>(`timeline_${videoId}`, TTL));
  if (local.length > 0) return { segments: local };

  const shared = clean(await pullSharedTimeline<ConceptSegment>(videoId));
  if (shared.length > 0) {
    cacheSet(`timeline_${videoId}`, shared);
    return { segments: shared };
  }

  try {
    const res = await authFetch('/api/analyze-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'timeline', videoId, title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const why = Array.isArray(data?.reasons) ? data.reasons.join('; ') : data?.error || `server error ${res.status}`;
      return { segments: null, reason: why };
    }
    const segments = clean(data?.segments);
    if (segments.length === 0) return { segments: null, reason: 'no concepts found' };
    cacheSet(`timeline_${videoId}`, segments);
    pushSharedTimeline(videoId, segments, String(data?.source ?? ''));
    return { segments };
  } catch {
    return { segments: null, reason: 'network problem' };
  }
}

/** Index of the segment playing at `sec` (last segment whose start <= sec). */
export function segmentIndexAt(segments: ConceptSegment[], sec: number): number {
  let idx = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start <= sec + 0.5) idx = i;
    else break;
  }
  return idx;
}
