import { useEffect, useRef, useState } from 'react';
import { authFetch } from './apiFetch';
import { pullSharedSearch, pushSharedSearch } from './sharedVideoCache';

// ============================================================
// BreakFeed.tsx — the in-app "reels-style" break.
// Vertical swipe feed of YouTube Shorts from the user's chosen interests
// (official embeds -> 0 playback quota, nothing to get blocked). The app owns
// the clock: countdown, then a SOFT landing ("+2 min once" or "back to video")
// instead of a sudden cut.
// ============================================================

interface Short {
  id: string;
  title: string;
  channel: string;
}

const EXTRA_SECONDS = 120;

// Friendly, funny nudges. They joke WITH the user (never at them), so nobody's ego gets poked.
const NEAR_END_MSGS = [
  'Bas thoda time 😄',
  'Thumb ka last round 👍',
  'Lecture yaad aa raha 😄',
  'Chai bhi wait kar rahi ☕',
  'Dimaag recharge ho gaya 🧠✨',
  'Video abhi bhi wahi 👀',
  'Bas ek minute aur 😄',
  'Thumb ki final trip 📱',
  'Break ka last scene 😎',
  'Lecture pause mein hai 📚',
  'Marks bhi wait mein hain 😄',
  'Dimaag ready ho gaya 🧠',
  'Shorts ka last round 🏁',
  'Chai ka sip pending ☕',
  'Lecture bhi intezaar mein 📖',
  'Thumb ghar laut raha 👍',
  'Break ka finale aa gaya 🎬',
  'Dimaag set hai ab 🧠✨',
  'Ek scroll aur bas 😄',
  'Video tumhe bula raha 👀',
  'Chai ki yaad aayi ☕😄',
  'Last minute wali masti 😎',
  'Lecture scene pending 📚',
  'Thumb ki chhutti khatam 👍',
  'Dimaag full charge hai 🔋',
  'Shorts ka endgame 🎬😄',
  'Notes bhi ready hain 📖',
  'Lecture milne wala hai 😄',
  'Final scroll chal raha 📱',
  'Break bas khatam honewala ⏳',
  'Bas ek minute 😄',
  'Thumb ko warmup do 👍',
  'Lecture tumhe yaad karega 😄',
  'Chai bhi ready hai ☕',
  'Brain loading complete 🧠✨',
  'Video abhi waiting hai 👀',
  'Last scroll ka scene 😎',
  'Thumb ki final flight 👍🚀',
  'Ek minute ki masti 😄',
  'Lecture pause pe chill 😌',
  'Marks bhi online hain 📚😄',
  'Brain bol raha hello 🧠👋',
  'Shorts ka last lap 🏁😄',
  'Lecture patiently wait kare 📖😄',
  'Thumb almost home 🏠👍',
  'Break ka finale 🎬😄',
  'Brain ready ho raha 🧠✨',
  'Ek scroll aur 😄📱',
  'Video miss kar raha 👀',
  'Chai bhi bula rahi ☕😄',
  'Last minute vibes 😎✨',
  'Thumb ki closing ceremony 🏆👍',
  'Brain ka recharge done 🔋🧠',
  'Shorts ka curtain call 🎬',
  'Notes bhi jag rahe 📖😄',
  'Lecture ki entry soon 🚪📚',
  'Final scroll incoming 📱✨',
  'Break almost complete 🥳',
];
const TIME_UP_MSGS = [
  'Chalo lecture pe 😄',
  'Dimaag wapas aa gaya 🧠',
  'Video ready hai 👀',
  'Chai saath mein chale ☕',
  'Thumb ko aaram mile 👍',
  'Agla topic ready hai 📚',
  'Lecture phir mil gaya 😄',
  'Dimaag ka next scene 🧠',
  'Notes bula rahe hain 📖',
  'Video bhi ready hai 👋',
  'Chalo, next concept 🧠✨',
  'Chai aur padhai ☕📚',
  'Agla idea aa raha 💡',
  'Lecture ka next scene 🎬',
  'Dimaag ki next ride 🚀',
  'Marks ka safar chale 📈',
  'Video ready, mood ready 😎',
  'Concepts bula rahe hain 💡',
  'Study wala scene on 📚',
  'Dimaag bol raha chalo 🧠',
  'Lecture ka comeback 📚😄',
  'Brain back online 🧠✨',
  'Chai saath le aao ☕',
  'Thumb ko rest do 👍',
  'Next chapter waiting 📖😎',
  'Brain ka next scene 🧠🎬',
  'Notes ready baithe 📚',
  'Video ne hello bola 👋',
  'Learning mode returns 🧠✨',
  'Chai aur concepts ☕📚',
  'Next idea incoming 💡😄',
  'Lecture ka sequel 🎬📖',
  'Brain ki next flight 🧠🚀',
  'Marks wali journey 📈😄',
  'Video ready, vibes ready 😎',
  'Study scene resumes 📚✨',
  'Brain bolta, chalo 🧠😄',
];
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadShorts(interest: string): Promise<Short[]> {
  const key = `search_shorts_${interest.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)}`;
  const shared = await pullSharedSearch<Short>(key);
  if (shared) return shared.items;
  const params = new URLSearchParams({ shorts: '1', maxResults: '25', q: `${interest} shorts` });
  const res = await authFetch(`/api/youtube?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Could not load shorts');
  const items: Short[] = (data.items ?? []).map((it: any) => ({
    id: it.id.videoId,
    title: it.snippet.title,
    channel: it.snippet.channelTitle,
  }));
  pushSharedSearch(key, items, null);
  return items;
}

export default function BreakFeed({
  interests,
  minutes,
  onDone,
}: {
  interests: string[];
  minutes: number;
  onDone: () => void;
}) {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [start, setStart] = useState(() => Date.now());
  const [deadline, setDeadline] = useState(() => Date.now() + minutes * 60_000);
  const [now, setNow] = useState(Date.now());
  const [extended, setExtended] = useState(false);
  const touchY = useRef<number | null>(null);
  const [nearMsg, setNearMsg] = useState<{ text: string; at: number; key: number } | null>(null);
  const [upMsg] = useState(() => pick(TIME_UP_MSGS));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lists = await Promise.all(interests.map((i) => loadShorts(i).catch(() => [] as Short[])));
        const seen = new Set<string>();
        const merged = lists.flat().filter((s) => s.id && !seen.has(s.id) && seen.add(s.id));
        if (cancelled) return;
        if (merged.length === 0) setError('No shorts right now. Back to your video?');
        setShorts(shuffle(merged));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const timeUp = remaining === 0;
  // Timeline: a quiet bar that fills slowly under the Short (no ticking numbers).
  const progress = Math.min(1, Math.max(0, (now - start) / Math.max(1, deadline - start)));
  // Near the end of the break, show ONE small funny message for ~8 seconds.
  useEffect(() => {
    if (progress >= 0.8 && !timeUp && (!nearMsg || nearMsg.key !== start)) {
      setNearMsg({ text: pick(NEAR_END_MSGS), at: Date.now(), key: start });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, timeUp, start]);
  const showNear = !!nearMsg && nearMsg.key === start && !timeUp && now - nearMsg.at < 8000;
  const current = shorts[index];
  const go = (d: number) => setIndex((i) => Math.min(Math.max(i + d, 0), Math.max(shorts.length - 1, 0)));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (touchY.current === null) return;
        const dy = touchY.current - e.changedTouches[0].clientY;
        if (Math.abs(dy) > 60) go(dy > 0 ? 1 : -1);
        touchY.current = null;
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > 40) go(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm opacity-70">Break</span>
        <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10">
          Back to video
        </button>
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 items-center justify-center px-1 pb-8">
        {loading && <p className="opacity-60">Loading your break…</p>}
        {!loading && error && <p className="px-6 text-center opacity-70">{error}</p>}
        {!loading && current && !timeUp && (
          <>
            <iframe
              key={current.id}
              title={current.title}
              src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${current.id}`}
              allow="autoplay; encrypted-media; fullscreen"
              className="aspect-[9/16] max-h-full w-full rounded-xl bg-black"
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col gap-3">
              <button onClick={() => go(-1)} className="rounded-full bg-white/15 px-3 py-2" aria-label="Previous">▲</button>
              <button onClick={() => go(1)} className="rounded-full bg-white/15 px-3 py-2" aria-label="Next">▼</button>
            </div>
          </>
        )}

        {showNear && nearMsg && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-3 top-2 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-sm font-medium text-black"
          >
            {nearMsg.text}
          </div>
        )}

        {!timeUp && !loading && current && (
          <div className="absolute inset-x-0 bottom-0">
            <div
              role="progressbar"
              aria-label="Break timeline"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="h-1 w-full overflow-hidden rounded-full bg-white/15"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-linear ${progress > 0.8 ? 'bg-amber-300' : 'bg-white/70'}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {timeUp && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
            <p className="text-xl font-semibold">Break time is up</p>
            <p className="text-sm">{upMsg}</p>
            <p className="text-xs opacity-60">Your video is waiting where you left it.</p>
            <button onClick={onDone} className="rounded-xl bg-white px-6 py-3 font-medium text-black">
              Back to video
            </button>
            {!extended && (
              <button
                onClick={() => {
                  setExtended(true);
                  setStart(Date.now()); // timeline restarts for the extra 2 minutes
                  setDeadline(Date.now() + EXTRA_SECONDS * 1000);
                }}
                className="rounded-xl border border-white/30 px-6 py-3"
              >
                +2 more minutes (once)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
