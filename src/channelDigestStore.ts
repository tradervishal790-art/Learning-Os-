import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { authFetch } from './apiFetch';
import { pushToCloud, pullFromCloud } from './cloudSync';
import { istDateKey } from './currentAffairsStore';

// ============================================================
// channelDigestStore.ts
//
// YouTube-channel digest for the Current Affairs section. For YESTERDAY (IST, 12 AM to 12 AM) the app
// covers EVERY video the channel uploaded, one by one.
//
// CHANNELS (private to the student): the list of channels they added. localStorage is the source
// of truth; saves are also pushed to users/{uid}/data/caChannels (same pattern as cloudSync.ts)
// and pulled once on a device that has nothing yet.
//
// TWO SHARED CACHES (so nothing is ever generated twice for anybody):
//   1. the day's video LIST   shared_channel_days/{channelId}_{date}_v1
//   2. each video's SUMMARY   shared_video_summaries/{videoId}_{locale}_v1
// Both follow the same order: this device's localStorage -> shared Firestore doc -> server API
// (then saved to both). Because every video is cached on its own, an interrupted run resumes where
// it stopped and a second student opening the same channel costs 0 AI.
//
// Only COMPLETED days are loadable — the server rejects today (its list would be partial).
// ============================================================

export type DigestCategory = 'national' | 'international' | 'economy' | 'sports' | 'scitech' | 'other';

export interface DayVideo {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  durationSeconds: number;
}
export interface VideoSummary {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  hasTranscript: boolean;
  gist: string;
  points: { category: DigestCategory; text: string }[];
}
export interface SavedChannel {
  channelId: string;
  title: string;
  handle?: string;
}

// Bump when the format changes so older cached/shared copies are ignored.
const CONTENT_VERSION = 'v2';
const DAY_KEY_PREFIX = 'learning_os_cd_day_';
const VIDEO_KEY_PREFIX = 'learning_os_cd_video_';
const CHANNELS_KEY = 'learning_os_ca_channels';
const CLOUD_KEY = 'caChannels';
export const MAX_CHANNELS = 5;
const KEEP_DAYS = 3;

/** The one day the digest covers: yesterday in India time. */
export function digestDate(): string {
  return istDateKey(1);
}

// ── Saved channels ──────────────────────────────────────────────────────────
function sanitizeChannels(raw: unknown): SavedChannel[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedChannel[] = [];
  for (const c of raw) {
    if (typeof c?.channelId !== 'string' || !/^UC[\w-]{22}$/.test(c.channelId) || seen.has(c.channelId)) continue;
    seen.add(c.channelId);
    out.push({
      channelId: c.channelId,
      title: typeof c.title === 'string' && c.title ? c.title : c.channelId,
      handle: typeof c.handle === 'string' && c.handle ? c.handle : undefined,
    });
    if (out.length >= MAX_CHANNELS) break;
  }
  return out;
}

export function loadChannels(): SavedChannel[] {
  try {
    const raw = localStorage.getItem(CHANNELS_KEY);
    return raw ? sanitizeChannels(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveChannels(list: SavedChannel[]): void {
  try {
    localStorage.setItem(CHANNELS_KEY, JSON.stringify(list));
  } catch {
    // non-critical
  }
  void pushToCloud(CLOUD_KEY, list);
}

/** Pull the cloud copy on a device that has no channels yet (new phone / browser). */
export async function hydrateChannelsFromCloud(): Promise<void> {
  if (loadChannels().length > 0) return;
  const cloud = await pullFromCloud<SavedChannel[]>(CLOUD_KEY);
  const list = sanitizeChannels(cloud);
  if (list.length > 0) {
    try {
      localStorage.setItem(CHANNELS_KEY, JSON.stringify(list));
    } catch {
      // Best-effort.
    }
  }
}

/** Looks the channel up on the server (link, @handle or name) and saves it. Returns the updated list. */
export async function addChannel(input: string): Promise<SavedChannel[]> {
  const current = loadChannels();
  if (current.length >= MAX_CHANNELS) throw new Error(`You can add up to ${MAX_CHANNELS} channels.`);

  const response = await authFetch('/api/research?op=channel-resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Could not find that channel (${response.status})`);
  if (typeof data?.channelId !== 'string') throw new Error("Couldn't find that channel.");
  if (current.some((c) => c.channelId === data.channelId)) return current; // already added

  const next = sanitizeChannels([...current, { channelId: data.channelId, title: data.title, handle: data.handle }]);
  saveChannels(next);
  return next;
}

export function removeChannel(channelId: string): SavedChannel[] {
  const next = loadChannels().filter((c) => c.channelId !== channelId);
  saveChannels(next);
  return next;
}

// ── Local cache helpers ─────────────────────────────────────────────────────
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Drop entries older than KEEP_DAYS so storage never grows (the date is right after the prefix).
    const oldest = istDateKey(KEEP_DAYS);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const prefix of [DAY_KEY_PREFIX, VIDEO_KEY_PREFIX]) {
        if (k.startsWith(prefix) && k.slice(prefix.length, prefix.length + 10) < oldest) localStorage.removeItem(k);
      }
    }
  } catch {
    // Storage full/unavailable — the shared copy still works.
  }
}

async function pullShared<T>(collection: string, id: string): Promise<T | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getDoc(doc(db, collection, id));
    return snap.exists() ? (snap.data() as T) : null;
  } catch {
    return null; // offline / rules not deployed yet
  }
}

function pushShared(collection: string, id: string, data: Record<string, unknown>): void {
  if (!auth.currentUser) return;
  void setDoc(doc(db, collection, id), { ...data, updatedAt: new Date().toISOString() }).catch(() => {
    // Best-effort — this student still has it locally.
  });
}

async function postApi<T>(op: string, body: Record<string, unknown>, failMsg: string): Promise<T> {
  const response = await authFetch(`/api/research?op=${op}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `${failMsg} (${response.status})`);
  return data as T;
}

// ── 1) The day's video list ─────────────────────────────────────────────────
function isDayVideo(v: any): v is DayVideo {
  return v && typeof v.videoId === 'string' && /^[\w-]{11}$/.test(v.videoId) && typeof v.title === 'string' && typeof v.url === 'string';
}

/** Every video the channel uploaded on `date` (a completed IST day), oldest first. */
export async function loadDayVideos(channel: SavedChannel, date: string): Promise<DayVideo[]> {
  const id = `${channel.channelId}_${date}_${CONTENT_VERSION}`;
  const localKey = `${DAY_KEY_PREFIX}${date}_${channel.channelId}_${CONTENT_VERSION}`;

  const local = readJson<{ videos?: unknown }>(localKey);
  if (Array.isArray(local?.videos)) return local.videos.filter(isDayVideo);

  const shared = await pullShared<{ videos?: unknown }>('shared_channel_days', id);
  if (Array.isArray(shared?.videos)) {
    const videos = shared.videos.filter(isDayVideo);
    writeJson(localKey, { videos });
    return videos;
  }

  const data = await postApi<{ videos?: unknown }>('channel-videos', { channelId: channel.channelId, date }, 'Could not load the videos');
  if (!Array.isArray(data?.videos)) throw new Error('The video list came back empty — please try again.');
  const videos = data.videos.filter(isDayVideo);
  writeJson(localKey, { videos });
  pushShared('shared_channel_days', id, { videos });
  return videos;
}

// ── 2) One video's summary ──────────────────────────────────────────────────
function isSummary(v: any): v is VideoSummary {
  return v && typeof v.videoId === 'string' && typeof v.gist === 'string' && Array.isArray(v.points);
}

/** The written summary of one video (cached per video, so it is generated at most once for everybody). */
export async function loadVideoSummary(videoId: string, date: string, locale: string): Promise<VideoSummary> {
  const id = `${videoId}_${locale}_${CONTENT_VERSION}`;
  const localKey = `${VIDEO_KEY_PREFIX}${date}_${id}`;

  const local = readJson<VideoSummary>(localKey);
  if (isSummary(local)) return local;

  const shared = await pullShared<VideoSummary>('shared_video_summaries', id);
  if (isSummary(shared)) {
    writeJson(localKey, shared);
    return shared;
  }

  const data = await postApi<VideoSummary>('video-summary', { videoId, locale }, 'Could not summarise this video');
  if (!isSummary(data)) throw new Error('The summary came back empty — please try again.');
  writeJson(localKey, data);
  pushShared('shared_video_summaries', id, data as unknown as Record<string, unknown>);
  return data;
}

// ------------------------------------------------------------------------
// FIRESTORE RULES — add these next to the shared_current_affairs rule in the
// Firebase console (Firestore Database -> Rules). Without them the shared
// read/write fails closed (permission-denied -> caught): every student then
// generates their own copy through the API, so the feature still works, it
// just loses the "each video is summarised once for everyone" saving.
//
//   match /shared_channel_days/{docId} {
//     allow read, write: if request.auth != null;
//   }
//   match /shared_video_summaries/{docId} {
//     allow read, write: if request.auth != null;
//   }
// ------------------------------------------------------------------------
