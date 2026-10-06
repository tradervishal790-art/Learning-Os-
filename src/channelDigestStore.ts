import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { authFetch } from './apiFetch';
import { pushToCloud, pullFromCloud } from './cloudSync';
import { istDateKey } from './currentAffairsStore';

// ============================================================
// channelDigestStore.ts
//
// YouTube-channel digest for the Current Affairs section.
//
// CHANNELS (private to the student): the list of channels they added. localStorage is the source
// of truth; saves are also pushed to users/{uid}/data/caChannels (same pattern as cloudSync.ts)
// and pulled once on a device that has nothing yet.
//
// DIGESTS (shared by everyone, so only the FIRST student to open a channel+day costs one AI call):
//   1. this device's localStorage                  (instant, offline)
//   2. shared Firestore doc                         shared_channel_digests/{channelId}_{date}_{locale}_v1
//   3. generate via /api/research?op=channel-digest, then save to 1 + 2
//
// Only COMPLETED days are loadable (yesterday and earlier) — today is still in progress, and the
// result would be cached for everyone.
// ============================================================

export type DigestCategory = 'national' | 'international' | 'economy' | 'sports' | 'scitech' | 'other';

export interface DigestVideo {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  hasTranscript: boolean;
  gist: string;
}
export interface DigestPoint {
  category: DigestCategory;
  text: string;
  videoId: string;
  url: string;
}
export interface ChannelDigest {
  channelId: string;
  date: string; // IST date, YYYY-MM-DD
  locale: string;
  videos: DigestVideo[];
  points: DigestPoint[];
  totalVideos: number; // qualifying videos the channel posted that day
  covered: number; // how many of them were summarised (capped on the server)
}
export interface SavedChannel {
  channelId: string;
  title: string;
  handle?: string;
}

// Bump when the digest format changes so older cached/shared copies are ignored.
const CONTENT_VERSION = 'v1';
const DIGEST_KEY_PREFIX = 'learning_os_cd_';
const CHANNELS_KEY = 'learning_os_ca_channels';
const CLOUD_KEY = 'caChannels';
export const MAX_CHANNELS = 5;
export const DIGEST_DAYS_BACK = 7; // yesterday ... 7 days ago
const KEEP_DAYS = 9;

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

// ── Digests ─────────────────────────────────────────────────────────────────
function localKey(channelId: string, date: string, locale: string): string {
  return `${DIGEST_KEY_PREFIX}${date}_${channelId}_${locale}_${CONTENT_VERSION}`;
}

function isDigest(d: any): d is Omit<ChannelDigest, 'channelId' | 'date' | 'locale'> {
  return d && Array.isArray(d.videos) && Array.isArray(d.points);
}

function readLocal(channelId: string, date: string, locale: string): ChannelDigest | null {
  try {
    const raw = localStorage.getItem(localKey(channelId, date, locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isDigest(parsed) ? (parsed as ChannelDigest) : null;
  } catch {
    return null;
  }
}

function writeLocal(d: ChannelDigest): void {
  try {
    localStorage.setItem(localKey(d.channelId, d.date, d.locale), JSON.stringify(d));
    // Drop digests older than KEEP_DAYS so storage never grows.
    const oldest = istDateKey(KEEP_DAYS);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(DIGEST_KEY_PREFIX) && k.slice(DIGEST_KEY_PREFIX.length, DIGEST_KEY_PREFIX.length + 10) < oldest) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // Storage full/unavailable — the shared copy still works.
  }
}

function sharedId(channelId: string, date: string, locale: string): string {
  return `${channelId}_${date}_${locale}_${CONTENT_VERSION}`;
}

async function pullShared(channelId: string, date: string, locale: string): Promise<ChannelDigest | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_channel_digests', sharedId(channelId, date, locale)));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!isDigest(d)) return null;
    return {
      channelId,
      date,
      locale,
      videos: d.videos,
      points: d.points,
      totalVideos: typeof d.totalVideos === 'number' ? d.totalVideos : d.videos.length,
      covered: typeof d.covered === 'number' ? d.covered : d.videos.length,
    };
  } catch {
    return null; // offline / rules not deployed yet
  }
}

function pushShared(d: ChannelDigest): void {
  if (!auth.currentUser) return;
  void setDoc(doc(db, 'shared_channel_digests', sharedId(d.channelId, d.date, d.locale)), {
    videos: d.videos,
    points: d.points,
    totalVideos: d.totalVideos,
    covered: d.covered,
    updatedAt: new Date().toISOString(),
  }).catch(() => {
    // Best-effort — this student still has it locally.
  });
}

/** Loads one channel's digest for one completed IST day (generating it if nobody has yet). */
export async function loadChannelDigest(channel: SavedChannel, date: string, locale: string): Promise<ChannelDigest> {
  const local = readLocal(channel.channelId, date, locale);
  if (local) return local;

  const shared = await pullShared(channel.channelId, date, locale);
  if (shared) {
    writeLocal(shared);
    return shared;
  }

  const response = await authFetch('/api/research?op=channel-digest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId: channel.channelId, channelTitle: channel.title, date, locale }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Could not load the digest (${response.status})`);
  if (!isDigest(data)) throw new Error('The digest came back empty — please try again.');

  const digest: ChannelDigest = {
    channelId: channel.channelId,
    date,
    locale,
    videos: data.videos,
    points: data.points,
    totalVideos: typeof data.totalVideos === 'number' ? data.totalVideos : data.videos.length,
    covered: typeof data.covered === 'number' ? data.covered : data.videos.length,
  };
  writeLocal(digest);
  pushShared(digest);
  return digest;
}

// ------------------------------------------------------------------------
// FIRESTORE RULES — add this next to the shared_current_affairs rule in the
// Firebase console (Firestore Database -> Rules). Without it the shared
// read/write fails closed (permission-denied -> caught): every student then
// generates their own copy through the API, so the feature still works, it
// just loses the "one AI call per channel per day for everyone" saving.
//
//   match /shared_channel_digests/{docId} {
//     allow read, write: if request.auth != null;
//   }
// ------------------------------------------------------------------------
