import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from './apiFetch';
import { pullSharedSearch, pushSharedSearch } from './sharedVideoCache';

// ============================================================
// FocusPlayer.tsx — standalone, distraction-free learning player.
//
//  1. Type a topic  ->  you get ONLY 3 videos (no endless list = no choice paralysis).
//  2. Watch in a clean player: no comments, no Shorts, no sidebar suggestions.
//  3. Take notes next to the video (auto-saved, with [mm:ss] timestamps).
//
// Quota: playback uses YouTube's official embed (0 quota). Searches go through
// the shared Firestore cache first, so a topic searched by anyone before costs 0.
// Route: /focus (works standalone). To plug into Learning OS later, render
// <FocusPlayer initialTopic="..." onClose={...} /> from any page.
// ============================================================

interface FocusVideo {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelId: string;
}

type Lang = 'any' | 'hi' | 'en';

const NOTES_PREFIX = 'learning_os_focus_notes_';
const LAST_TOPIC_KEY = 'learning_os_focus_last_topic';

// "Best 3": keep YouTube's relevance order, but at most one video per channel,
// so the 3 choices are genuinely different teachers.
function pickThree(items: FocusVideo[]): FocusVideo[] {
  const seen = new Set<string>();
  const out: FocusVideo[] = [];
  for (const v of items) {
    if (seen.has(v.channelId)) continue;
    seen.add(v.channelId);
    out.push(v);
    if (out.length === 3) break;
  }
  if (out.length < 3) {
    for (const v of items) {
      if (out.length === 3) break;
      if (!out.some((o) => o.id === v.id)) out.push(v);
    }
  }
  return out;
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

const fmt = (sec: number) => {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function FocusPlayer({ initialTopic = '', onClose }: { initialTopic?: string; onClose?: () => void }) {
  const [topic, setTopic] = useState(initialTopic || localStorage.getItem(LAST_TOPIC_KEY) || '');
  const [lang, setLang] = useState<Lang>('any');
  const [picks, setPicks] = useState<FocusVideo[]>([]);
  const [active, setActive] = useState<FocusVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const playerRef = useRef<any>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const search = useCallback(async (q: string, l: Lang) => {
    const clean = q.trim();
    if (!clean) return;
    setLoading(true);
    setError('');
    setActive(null);
    localStorage.setItem(LAST_TOPIC_KEY, clean);
    try {
      const key = `search_focus_${l}_${clean.toLowerCase().replace(/\s+/g, ' ').slice(0, 120)}`;
      const shared = await pullSharedSearch<FocusVideo>(key);
      if (shared) {
        setPicks(pickThree(shared.items));
        return;
      }
      const params = new URLSearchParams({ maxResults: '12', q: `${clean} lecture explained` });
      if (l !== 'any') params.set('relevanceLanguage', l);
      const res = await authFetch(`/api/youtube?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not load videos');
      const items: FocusVideo[] = (data.items ?? []).map((it: any) => ({
        id: it.id.videoId,
        title: it.snippet.title,
        thumbnail: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url ?? '',
        channel: it.snippet.channelTitle,
        channelId: it.snippet.channelId,
      }));
      if (items.length === 0) {
        setPicks([]);
        setError('No videos found. Try a simpler topic.');
        return;
      }
      setPicks(pickThree(items));
      pushSharedSearch(key, items, data.nextPageToken ?? null);
    } catch (e: any) {
      setPicks([]);
      setError(e?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTopic) void search(initialTopic, 'any');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved notes when a video is opened.
  useEffect(() => {
    if (active) setNotes(localStorage.getItem(NOTES_PREFIX + active.id) ?? '');
  }, [active]);

  // Auto-save notes.
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => localStorage.setItem(NOTES_PREFIX + active.id, notes), 400);
    return () => clearTimeout(id);
  }, [notes, active]);

  // Create the player when a video is opened.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void loadYouTubeApi().then(() => {
      if (cancelled) return;
      playerRef.current?.destroy?.();
      playerRef.current = new (window as any).YT.Player('focus-yt-player', {
        videoId: active.id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1, fs: 1 },
        events: {
          // When the video ends, reset to the first frame so YouTube's
          // end-screen "more videos" never appears.
          onStateChange: (e: any) => {
            if (e.data === 0) playerRef.current?.cueVideoById(active.id);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [active]);

  const addTimestamp = () => {
    const sec = playerRef.current?.getCurrentTime?.() ?? 0;
    const stamp = `[${fmt(sec)}] `;
    setNotes((n) => (n && !n.endsWith('\n') ? `${n}\n${stamp}` : `${n}${stamp}`));
    notesRef.current?.focus();
  };

  const inputCls =
    'rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none focus:border-black dark:border-white/20 dark:bg-black dark:text-white dark:focus:border-white';

  // ---------- Watching screen ----------
  if (active) {
    return (
      <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white">
        <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
          <button onClick={() => setActive(null)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10">
            ← Back
          </button>
          <p className="truncate text-sm font-medium">{active.title}</p>
        </div>
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 lg:grid-cols-[2fr_1fr]">
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <div id="focus-yt-player" className="h-full w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">My notes</h2>
              <button onClick={addTimestamp} className="rounded-lg border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
                + Time
              </button>
            </div>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write what you learn here…"
              className={`${inputCls} min-h-[240px] flex-1 resize-none lg:min-h-0`}
            />
            <p className="text-xs opacity-50">Saved automatically</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Topic + 3 picks screen ----------
  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Focus Player</h1>
            <p className="mt-1 text-sm opacity-60">One topic. Three videos. No distractions.</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
              Close
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search(topic, lang)}
            placeholder="What do you want to learn?"
            className={`${inputCls} flex-1`}
          />
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={inputCls}>
            <option value="any">Any language</option>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </select>
          <button
            onClick={() => void search(topic, lang)}
            disabled={loading || !topic.trim()}
            className="rounded-xl bg-black px-6 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {loading ? 'Finding…' : 'Show me'}
          </button>
        </div>

        {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-8 grid gap-4">
          {picks.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActive(v)}
              className="flex items-center gap-4 rounded-2xl border border-black/10 p-3 text-left transition hover:border-black dark:border-white/15 dark:hover:border-white"
            >
              <img src={v.thumbnail} alt="" className="h-24 w-40 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="text-xs opacity-50">Pick {i + 1}</p>
                <p className="line-clamp-2 font-semibold">{v.title}</p>
                <p className="mt-1 text-sm opacity-60">{v.channel}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
