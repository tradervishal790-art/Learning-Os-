// src/videoTime.ts
// Pure helpers for lecture-video timestamps. No React, no DOM.

export const MAX_TIMESTAMP_SECONDS = 172_800; // 48 h — same cap the editor node uses

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID_RE.test(value);
}

/* ------------------------------ format / parse ------------------------------ */

/** 75 -> "1:15", 3725 -> "1:02:05". Negative / NaN / Infinity -> "0:00". Decimals are floored. */
export function formatTimestamp(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const TWO_PART_RE = /^(\d+):(\d{2})$/; // m:ss
const THREE_PART_RE = /^(\d+):(\d{1,2}):(\d{2})$/; // h:mm:ss
const PLAIN_RE = /^\d+$/; // 75
const UNITS_RE = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/; // 1h2m3s, 75s, 2m

function toInt(digits: string | undefined): number {
  return digits === undefined ? 0 : Number.parseInt(digits, 10);
}

/**
 * "75", "1:15", "01:15", "1:02:03", "1h2m3s", "75s" -> seconds. Anything else -> null.
 * Integers only; minutes/seconds in colon form must be < 60 (except the leading part).
 */
export function parseTimestamp(text: string): number | null {
  if (typeof text !== 'string') return null;
  const t = text.trim().toLowerCase();
  if (t === '') return null;

  let total: number | null = null;

  const three = THREE_PART_RE.exec(t);
  const two = three ? null : TWO_PART_RE.exec(t);
  if (three) {
    const h = toInt(three[1]);
    const m = toInt(three[2]);
    const s = toInt(three[3]);
    if (m < 60 && s < 60) total = h * 3600 + m * 60 + s;
  } else if (two) {
    const m = toInt(two[1]);
    const s = toInt(two[2]);
    if (s < 60) total = m * 60 + s;
  } else if (PLAIN_RE.test(t)) {
    total = toInt(t);
  } else {
    const units = UNITS_RE.exec(t.replace(/\s+/g, ''));
    if (units && (units[1] !== undefined || units[2] !== undefined || units[3] !== undefined)) {
      total = toInt(units[1]) * 3600 + toInt(units[2]) * 60 + toInt(units[3]);
    }
  }

  return total !== null && Number.isSafeInteger(total) ? total : null;
}

/* --------------------------------- YouTube --------------------------------- */

const YOUTUBE_HOSTS: ReadonlySet<string> = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const PATH_ID_PREFIXES: ReadonlySet<string> = new Set(['embed', 'shorts', 'live']);

export interface YouTubeUrlInfo {
  videoId: string;
  startSeconds: number;
}

export function parseYouTubeUrl(url: string): YouTubeUrlInfo | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed === '') return null;

  const candidateUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.port !== '' || parsed.username !== '' || parsed.password !== '') return null;

  // Exact host match only: "youtube.com.evil.com" or "evil.com/youtube.com" never pass.
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter((segment) => segment !== '');
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = segments[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    const first = segments[0];
    if (first === 'watch') {
      id = parsed.searchParams.get('v');
    } else if (first !== undefined && PATH_ID_PREFIXES.has(first)) {
      id = segments[1] ?? null;
    }
  } else {
    return null;
  }

  if (!isValidVideoId(id)) return null;

  const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
  const rawStart = parsed.searchParams.get('t') ?? parsed.searchParams.get('start') ?? hashParams.get('t');
  const start = rawStart === null ? null : parseTimestamp(rawStart);

  return { videoId: id, startSeconds: Math.min(start ?? 0, MAX_TIMESTAMP_SECONDS) };
}

export function timestampUrl(videoId: string, seconds: number): string {
  const t = Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.floor(seconds), MAX_TIMESTAMP_SECONDS) : 0;
  return `https://youtu.be/${encodeURIComponent(videoId)}?t=${t}`;
}

/* --------------------------------- moments --------------------------------- */

export type MomentKind = 'confusing' | 'important' | 'revisit';

export interface VideoMoment {
  id: string;
  seconds: number;
  kind: MomentKind;
  note: string;
  createdAt: string;
}

let idCounter = 0;

export function newMomentId(): string {
  // randomUUID only exists in secure contexts (https / localhost) — a tablet on a LAN dev URL has none.
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoLike && typeof cryptoLike.randomUUID === 'function') {
    try {
      return cryptoLike.randomUUID();
    } catch {
      /* fall through to the manual id */
    }
  }
  idCounter = (idCounter + 1) % 0xffffff;
  return `m-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Sorted by seconds, stable for equal times, always a new array. Non-finite seconds go last. */
export function sortMoments(moments: VideoMoment[]): VideoMoment[] {
  return moments
    .map((moment, index) => ({
      moment,
      index,
      key: Number.isFinite(moment.seconds) ? moment.seconds : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index))
    .map((entry) => entry.moment);
}

const ACTIVE_TOLERANCE_SECONDS = 0.5;

/** The last moment (in time order) whose seconds <= currentSeconds + 0.5. Ties -> the later one in the array. */
export function activeMomentId(moments: VideoMoment[], currentSeconds: number): string | null {
  if (!Number.isFinite(currentSeconds)) return null;
  const limit = currentSeconds + ACTIVE_TOLERANCE_SECONDS;
  let best: VideoMoment | null = null;
  for (const moment of moments) {
    if (!Number.isFinite(moment.seconds) || moment.seconds > limit) continue;
    if (best === null || moment.seconds >= best.seconds) best = moment;
  }
  return best === null ? null : best.id;
}
