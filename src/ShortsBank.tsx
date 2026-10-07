import { useState } from 'react';
import type { SavedShort } from './focusStore';
import { decodeHtml } from './textUtil';

// ============================================================
// ShortsBank.tsx — the separate "bank" section.
// Skipped breaks become EARNED Shorts time + saved Shorts. Watching a saved
// Short costs 1 minute from the bank, so Shorts feel like earnings, not a habit.
// ============================================================

const WATCH_COST_SEC = 60;

export default function ShortsBank({
  bankSec,
  skipsToday,
  earnedTodaySec,
  skipsTotal,
  saved,
  onSpend,
  onRemove,
  onBack,
}: {
  bankSec: number;
  skipsToday: number;
  earnedTodaySec: number;
  skipsTotal: number;
  saved: SavedShort[];
  onSpend: (sec: number) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
}) {
  const [watching, setWatching] = useState<SavedShort | null>(null);
  const canWatch = bankSec >= WATCH_COST_SEC;

  const stat = 'rounded-2xl border border-black/10 p-3 dark:border-white/15';

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Shorts bank 💰</h1>
          <button onClick={onBack} className="rounded-lg px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className={stat}>
            <p className="text-xs opacity-60">In your bank</p>
            <p className="text-2xl font-bold">{Math.floor(bankSec / 60)} min</p>
          </div>
          <div className={stat}>
            <p className="text-xs opacity-60">Earned today</p>
            <p className="text-2xl font-bold">{Math.round(earnedTodaySec / 60)} min</p>
          </div>
          <div className={stat}>
            <p className="text-xs opacity-60">Skips today</p>
            <p className="text-2xl font-bold">{skipsToday}</p>
          </div>
        </div>
        <p className="mt-2 text-xs opacity-60">Total skips so far: {skipsTotal}</p>

        <h2 className="mb-1 mt-8 font-semibold">Saved Shorts</h2>
        <p className="mb-3 text-sm opacity-60">Skip a break and a few Shorts get saved here. Watching one costs 1 min from your bank.</p>

        {saved.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/20 p-6 text-center text-sm opacity-60 dark:border-white/25">
            Nothing saved yet. Skip your next break to earn some.
          </p>
        )}

        <div className="grid gap-3">
          {saved.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-black/10 p-3 dark:border-white/15">
              <img src={`https://i.ytimg.com/vi/${s.id}/mqdefault.jpg`} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{decodeHtml(s.title) || 'Short'}</p>
                <p className="mt-0.5 text-xs opacity-60">{s.channel}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => {
                    if (!canWatch) return;
                    onSpend(WATCH_COST_SEC);
                    setWatching(s);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${canWatch ? 'bg-black text-white dark:bg-white dark:text-black' : 'border border-black/15 opacity-50 dark:border-white/20'}`}
                >
                  Watch · 1 min
                </button>
                <button onClick={() => onRemove(s.id)} className="text-xs opacity-50 hover:opacity-100">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        {!canWatch && saved.length > 0 && <p className="mt-3 text-xs opacity-60">Your bank is empty. Skip a break to earn more.</p>}
      </div>

      {watching && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm opacity-70">Paid from your bank 💰</span>
            <button
              onClick={() => {
                onRemove(watching.id);
                setWatching(null);
              }}
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Done
            </button>
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 items-center justify-center pb-6">
            <iframe
              title={watching.title}
              src={`https://www.youtube-nocookie.com/embed/${watching.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
              allow="autoplay; encrypted-media; fullscreen"
              className="aspect-[9/16] max-h-full w-full rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}
