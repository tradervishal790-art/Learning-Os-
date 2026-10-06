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
const MINUTE_OPTIONS = [3, 5, 7, 10]; // break length — kept short on purpose
const EVERY_OPTIONS = [10, 15, 20, 25, 30, 45]; // focus time between breaks
const MAX_FOCUS_MIN = 60;
const GROW_STEP_SEC = 15; // focus time quietly grows by 15 seconds after each completed break
const SKIP_WAIT_MIN_SEC = 5 * 60; // after Skip, the next prompt comes after half the focus time (at least 5 min)
const INTEREST_OPTIONS = ['Cricket', 'Comedy', 'Music', 'Tech', 'Motivation', 'Science', 'Gaming', 'Food'];

interface BreakPrefs {
  everyMin: number; // user's own starting focus time between breaks (0 = no breaks)
  bonusSec: number; // seconds of quiet growth earned so far (never shown to the user)
  minutes: number; // break length
  locked: boolean; // focus time + break length can be chosen only ONCE
  interests: string[];
}

function loadBreakPrefs(): BreakPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(BREAK_PREFS_KEY) ?? '');
    const every = Number(p.everyMin);
    const m = Number(p.minutes);
    return {
      everyMin: EVERY_OPTIONS.includes(every) ? every : 0,
      bonusSec: Math.min(MAX_FOCUS_MIN * 60, Math.max(0, Number(p.bonusSec) || 0)),
      minutes: MINUTE_OPTIONS.includes(m) ? m : 5,
      locked: p.locked === true,
      interests: Array.isArray(p.interests) ? p.interests.slice(0, 3) : [],
    };
  } catch {
    return { everyMin: 0, bonusSec: 0, minutes: 5, locked: false, interests: [] };
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

// ---- Shorts bank: every skipped break is "earned" Shorts time the user can spend later.
interface Bank {
  bankSec: number;
  skipsTotal: number;
  date: string; // local day the "today" counters belong to
  skipsToday: number;
  earnedTodaySec: number;
}
const BANK_KEY = 'learning_os_focus_bank';
const BANK_CAP_SEC = 30 * 60; // can't hoard more than 30 min
const todayKey = () => new Date().toLocaleDateString('en-CA');

function loadBank(): Bank {
  const empty: Bank = { bankSec: 0, skipsTotal: 0, date: todayKey(), skipsToday: 0, earnedTodaySec: 0 };
  try {
    const b = JSON.parse(localStorage.getItem(BANK_KEY) ?? '');
    const bank: Bank = {
      bankSec: Math.min(BANK_CAP_SEC, Math.max(0, Number(b.bankSec) || 0)),
      skipsTotal: Math.max(0, Number(b.skipsTotal) || 0),
      date: typeof b.date === 'string' ? b.date : todayKey(),
      skipsToday: Math.max(0, Number(b.skipsToday) || 0),
      earnedTodaySec: Math.max(0, Number(b.earnedTodaySec) || 0),
    };
    return bank.date === todayKey() ? bank : { ...bank, date: todayKey(), skipsToday: 0, earnedTodaySec: 0 };
  } catch {
    return empty;
  }
}

// Focus clock = REAL time (wall clock), never the video's own timeline, so seeking,
// skipping ahead, pausing or changing speed can't dodge or trigger a break.
// It survives a quick refresh/reopen (same stretch continues) but resets after a long gap.
const CLOCK_START_KEY = 'learning_os_focus_clock_start';
const CLOCK_SEEN_KEY = 'learning_os_focus_clock_seen';
const CLOCK_GAP_MS = 5 * 60 * 1000;

function restoreClockStart(): number {
  const now = Date.now();
  const start = Number(localStorage.getItem(CLOCK_START_KEY));
  const seen = Number(localStorage.getItem(CLOCK_SEEN_KEY));
  if (start > 0 && seen > 0 && now - seen < CLOCK_GAP_MS && start <= now) return start;
  return now;
}
function saveClock(start: number) {
  localStorage.setItem(CLOCK_START_KEY, String(start));
  localStorage.setItem(CLOCK_SEEN_KEY, String(Date.now()));
}

export default function FocusPlayer({ initialTopic = '', onClose }: { initialTopic?: string; onClose?: () => void }) {
  const [topic, setTopic] = useState(initialTopic || localStorage.getItem(LAST_TOPIC_KEY) || '');
  const [lang, setLang] = useState<Lang>('any');
  const [picks, setPicks] = useState<FocusVideo[]>([]);
  const [active, setActive] = useState<FocusVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [breakPrefs, setBreakPrefs] = useState<BreakPrefs>(loadBreakPrefs);
  const [bank, setBank] = useState<Bank>(loadBank);
  const [bankToast, setBankToast] = useState('');
  const [breakPrompt, setBreakPrompt] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const [breakProgress, setBreakProgress] = useState(0); // 0..1, drives the quiet bottom line
  const clockStartRef = useRef(Date.now()); // real wall-clock moment the current focus stretch began
  const breaksOn = breakPrefs.everyMin > 0 && breakPrefs.interests.length > 0;
  const focusSec = Math.min(MAX_FOCUS_MIN * 60, breakPrefs.everyMin * 60 + breakPrefs.bonusSec);
  const focusSecRef = useRef(focusSec);
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

  useEffect(() => {
    localStorage.setItem(BANK_KEY, JSON.stringify(bank));
  }, [bank]);

  useEffect(() => {
    if (!bankToast) return;
    const id = setTimeout(() => setBankToast(''), 4000);
    return () => clearTimeout(id);
  }, [bankToast]);

  const spendBank = (sec: number) => setBank((b) => ({ ...b, bankSec: Math.max(0, b.bankSec - sec) }));

  // New video -> fresh focus clock. The first time breaks are really used, the choice locks.
  useEffect(() => {
    if (!active) return;
    clockStartRef.current = restoreClockStart();
    saveClock(clockStartRef.current);
    setBreakProgress(Math.min(1, (Date.now() - clockStartRef.current) / 1000 / focusSecRef.current));
    if (breaksOn) setBreakPrefs((p) => (p.locked ? p : { ...p, locked: true }));
    setBreakPrompt(false);
    setBreakOpen(false);
  }, [active]);

  // Keep the bottom line right whenever the focus time changes.
  useEffect(() => {
    focusSecRef.current = focusSec;
    setBreakProgress(Math.min(1, (Date.now() - clockStartRef.current) / 1000 / focusSec));
  }, [focusSec, active]);

  // Focus clock: real elapsed time since the last break. When the user's focus time
  // is reached, pause and offer the break.
  useEffect(() => {
    if (!active || !breaksOn || breakOpen || breakPrompt) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - clockStartRef.current) / 1000;
      const limit = focusSecRef.current;
      setBreakProgress(Math.min(1, elapsed / limit));
      localStorage.setItem(CLOCK_SEEN_KEY, String(Date.now()));
      if (elapsed >= limit) {
        playerRef.current?.pauseVideo?.();
        setBreakPrompt(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active, breaksOn, breakOpen, breakPrompt]);

  // waitSec = how long until the next prompt (default: the full focus time).
  const restartClock = (waitSec?: number) => {
    const limit = focusSecRef.current;
    const wait = Math.min(limit, waitSec ?? limit);
    clockStartRef.current = Date.now() - (limit - wait) * 1000;
    saveClock(clockStartRef.current);
    setBreakProgress((limit - wait) / limit);
  };

  const startBreak = () => {
    playerRef.current?.pauseVideo?.();
    setBreakPrompt(false);
    setBreakOpen(true);
  };
  const skipBreak = () => {
    // Skip = shorts don't come back at once, but the wait is only half the focus time
    // (min 5 min), so it never feels like a punishment.
    restartClock(Math.max(SKIP_WAIT_MIN_SEC, Math.round(focusSecRef.current / 2)));
    // Every skip is EARNED Shorts time, banked for later.
    const t = todayKey();
    const base = bank.date === t ? bank : { ...bank, date: t, skipsToday: 0, earnedTodaySec: 0 };
    const earn = Math.max(0, Math.min(BANK_CAP_SEC - base.bankSec, breakPrefs.minutes * 60));
    setBank({
      ...base,
      bankSec: base.bankSec + earn,
      skipsTotal: base.skipsTotal + 1,
      skipsToday: base.skipsToday + 1,
      earnedTodaySec: base.earnedTodaySec + earn,
    });
    setBankToast(earn > 0 ? `Skipped! +${Math.round(earn / 60)} min added to your Shorts bank 💰` : 'Skipped! Your Shorts bank is full 💰');
    setBreakPrompt(false);
    playerRef.current?.playVideo?.();
  };
  const endBreak = () => {
    setBreakOpen(false);
    playerRef.current?.playVideo?.();
    restartClock();
    // Quietly stretch the focus time by 15 s after every completed break (never shown to the user).
    setBreakPrefs((p) =>
      p.everyMin * 60 + p.bonusSec < MAX_FOCUS_MIN * 60 ? { ...p, bonusSec: p.bonusSec + GROW_STEP_SEC } : p
    );
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
          {bank.skipsTotal > 0 && <span className="shrink-0 text-xs opacity-70">💰 {Math.floor(bank.bankSec / 60)} min</span>}
        </div>
        {bankToast && (
          <div role="status" className="fixed inset-x-4 top-16 z-50 mx-auto max-w-sm rounded-xl bg-black px-4 py-3 text-center text-sm font-medium text-white dark:bg-white dark:text-black">
            {bankToast}
          </div>
        )}
        {breakPrompt && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-black dark:bg-neutral-900 dark:text-white">
              <p className="text-lg font-semibold">Nice focus! Time for your shorts?</p>
              <p className="mt-1 text-sm opacity-60">{breakPrefs.minutes} min. Your video is paused and will resume right here.</p>
              <button onClick={startBreak} className="mt-5 w-full rounded-xl bg-black px-4 py-3 font-medium text-white dark:bg-white dark:text-black">
                Start shorts
              </button>
              <button
                onClick={skipBreak}
                className="mt-2 w-full rounded-xl px-4 py-3 text-sm opacity-70"
              >
                Skip
              </button>
            </div>
          </div>
        )}
        {breakOpen && <BreakFeed interests={breakPrefs.interests} minutes={breakPrefs.minutes} bankSec={bank.bankSec} onSpend={spendBank} onDone={endBreak} />}
        {breaksOn && (
          <div
            role="progressbar"
            aria-label="Approaching your break"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(breakProgress * 100)}
            className="fixed inset-x-0 bottom-0 z-30 h-1 bg-black/10 dark:bg-white/10"
          >
            <div
              className="h-full bg-black/60 transition-[width] duration-1000 ease-linear dark:bg-white/60"
              style={{ width: `${breakProgress * 100}%` }}
            />
          </div>
        )}
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

        {(breaksOn || bank.skipsTotal > 0) && (
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-black/10 p-4 dark:border-white/15">
            <div>
              <p className="text-xs opacity-60">Your Shorts bank</p>
              <p className="text-2xl font-bold">💰 {Math.floor(bank.bankSec / 60)} min</p>
            </div>
            <div className="text-right text-sm">
              <p>Skipped today: <span className="font-semibold">{bank.skipsToday}</span></p>
              <p className="opacity-60">Total skips: {bank.skipsTotal}</p>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-black/10 p-4 dark:border-white/15">
          {breakPrefs.locked ? (
            <p className="text-sm">
              Shorts break after every <span className="font-semibold">{breakPrefs.everyMin} min</span> of focus, {breakPrefs.minutes} min each.
              <span className="mt-1 block text-xs opacity-60">You set this once, so it stays steady.</span>
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Shorts break after every</p>
                <select
                  value={breakPrefs.everyMin}
                  onChange={(e) => setBreakPrefs((p) => ({ ...p, everyMin: Number(e.target.value), bonusSec: 0 }))}
                  className={`${inputCls} py-1.5 text-sm`}
                >
                  <option value={0}>No breaks</option>
                  {EVERY_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} min of focus
                    </option>
                  ))}
                </select>
              </div>
              {breakPrefs.everyMin > 0 && (
                <>
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
                  <p className="mt-2 text-xs opacity-60">You can choose this only once.</p>
                </>
              )}
            </>
          )}
          {breakPrefs.everyMin > 0 && (
            <>
              <p className="mt-3 text-xs opacity-60">
                {breakPrefs.interests.length === 0 ? 'Pick at least 1 interest to turn breaks on (up to 3)' : 'Pick up to 3 interests for your break feed'}
              </p>
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
