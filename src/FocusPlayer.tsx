import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from './apiFetch';
import { pullSharedSearch, pushSharedSearch } from './sharedVideoCache';
import BreakFeed from './BreakFeed';

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
const BREAK_PREFS_KEY = 'learning_os_focus_break_prefs';
const MINUTE_OPTIONS = [3, 5, 8, 10, 15];
const INTEREST_OPTIONS = ['Cricket', 'Comedy', 'Music', 'Tech', 'Motivation', 'Science', 'Gaming', 'Food'];

function loadBreakPrefs(): { breaks: number; minutes: number; interests: string[] } {
  try {
    const p = JSON.parse(localStorage.getItem(BREAK_PREFS_KEY) ?? '');
    const m = Number(p.minutes);
    return {
      breaks: Math.min(3, Math.max(0, Number(p.breaks) || 0)),
      minutes: MINUTE_OPTIONS.includes(m) ? m : 5,
      interests: Array.isArray(p.interests) ? p.interests.slice(0, 3) : [],
    };
  } catch {
    return { breaks: 0, minutes: 5, interests: [] };
  }
}

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
  const [breakPrefs, setBreakPrefs] = useState(loadBreakPrefs);
  const [breaksLeft, setBreaksLeft] = useState(0);
  const [breakPrompt, setBreakPrompt] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const milestoneRef = useRef(0); // how many auto-prompts already shown for this video
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

  useEffect(() => {
    localStorage.setItem(BREAK_PREFS_KEY, JSON.stringify(breakPrefs));
  }, [breakPrefs]);

  // Fresh break bank every time a video is opened.
  useEffect(() => {
    if (!active) return;
    const usable = breakPrefs.interests.length > 0 ? breakPrefs.breaks : 0;
    setBreaksLeft(usable);
    milestoneRef.current = 0;
    setBreakPrompt(false);
    setBreakOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Watch progress: at 1/(n+1), 2/(n+1)... of the video, pause and offer a break.
  useEffect(() => {
    if (!active) return;
    const total = breakPrefs.interests.length > 0 ? breakPrefs.breaks : 0;
    if (total === 0) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getDuration || breakOpen || breakPrompt) return;
      const dur = p.getDuration();
      if (!dur || p.getPlayerState?.() !== 1) return;
      const next = milestoneRef.current;
      if (next >= total) return;
      if (p.getCurrentTime() >= (dur * (next + 1)) / (total + 1)) {
        milestoneRef.current = next + 1;
        p.pauseVideo();
        setBreakPrompt(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active, breakPrefs, breakOpen, breakPrompt]);

  const startBreak = () => {
    if (breaksLeft <= 0) return;
    playerRef.current?.pauseVideo?.();
    setBreaksLeft((n) => n - 1);
    setBreakPrompt(false);
    setBreakOpen(true);
  };
  const endBreak = () => {
    setBreakOpen(false);
    playerRef.current?.playVideo?.();
  };

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
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{active.title}</p>
          {breakPrefs.breaks > 0 && breakPrefs.interests.length > 0 && (
            <button
              onClick={startBreak}
              disabled={breaksLeft <= 0}
              className="shrink-0 rounded-lg border border-black/15 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-white/20"
            >
              Break ({breaksLeft})
            </button>
          )}
        </div>
        {breakPrompt && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-black dark:bg-neutral-900 dark:text-white">
              <p className="text-lg font-semibold">Nice focus! Take a {breakPrefs.minutes}-min break?</p>
              <p className="mt-1 text-sm opacity-60">Your video is paused and will resume right here.</p>
              <button onClick={startBreak} className="mt-5 w-full rounded-xl bg-black px-4 py-3 font-medium text-white dark:bg-white dark:text-black">
                Take break
              </button>
              <button
                onClick={() => {
                  setBreakPrompt(false);
                  playerRef.current?.playVideo?.();
                }}
                className="mt-2 w-full rounded-xl px-4 py-3 text-sm opacity-70"
              >
                Not now (keep it for later)
              </button>
            </div>
          </div>
        )}
        {breakOpen && <BreakFeed interests={breakPrefs.interests} minutes={breakPrefs.minutes} onDone={endBreak} />}
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

        <div className="mt-6 rounded-2xl border border-black/10 p-4 dark:border-white/15">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Breaks while watching</p>
            <select
              value={breakPrefs.breaks}
              onChange={(e) => setBreakPrefs((p) => ({ ...p, breaks: Number(e.target.value) }))}
              className={`${inputCls} py-1.5 text-sm`}
            >
              <option value={0}>No breaks</option>
              <option value={1}>1 break</option>
              <option value={2}>2 breaks</option>
              <option value={3}>3 breaks</option>
            </select>
          </div>
          {breakPrefs.breaks > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm">Each break lasts</p>
              <select
                value={breakPrefs.minutes}
                onChange={(e) => setBreakPrefs((p) => ({ ...p, minutes: Number(e.target.value) }))}
                className={`${inputCls} py-1.5 text-sm`}
              >
                {MINUTE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          )}
          {breakPrefs.breaks > 0 && (
            <>
              <p className="mt-3 text-xs opacity-60">Pick up to 3 interests for your break feed</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((name) => {
                  const on = breakPrefs.interests.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() =>
                        setBreakPrefs((p) => ({
                          ...p,
                          interests: on ? p.interests.filter((x) => x !== name) : p.interests.length < 3 ? [...p.interests, name] : p.interests,
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-black/15 dark:border-white/20'}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
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
