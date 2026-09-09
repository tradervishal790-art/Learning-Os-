import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLearningProfile, saveLearningProfile, mergeLearningProfile } from './learningProfileStore';
import { averageTasteSignals, buildFreshProfileFromTaste } from './tasteProfileScoring';
import type { LearningProfile, TasteVideoResult } from './types';
import HintBubble from './HintBubble';

// ============================================================
// TasteOnboarding.tsx
//
// Alternative to the Blueprint Interview / old 12-question quiz — instead
// of asking questions, the user pastes YouTube videos they've ALREADY
// fully watched (real behavioral evidence > self-report). Each video must
// be 45+ min. api/analyze-taste-video.ts scores each one; results are
// averaged and merged into the same LearningProfile the rest of the app
// already reads (learningProfileStore.ts) — so Roadmap/PlaylistBuilder
// personalization works identically regardless of which onboarding path
// the user took.
//
// Does NOT replace BlueprintInterview.tsx/LearningQuiz.tsx — both remain
// fully intact and reachable from Dashboard.tsx.
//
// Deliberately does NOT show the full dimension breakdown on completion —
// only a short confirmation. (The existing "Learning Style" card on the
// dashboard home page will still show the full breakdown once a profile
// exists — that's pre-existing Dashboard behavior, unchanged here.)
// ============================================================

const MIN_VIDEOS = 5;
const MIN_DURATION_MINUTES = 45;

type ItemStatus = 'pending' | 'analyzing' | 'done' | 'error';

interface VideoEntry {
  id: string; // local key, not the YouTube videoId
  url: string;
  watchedFully: boolean;
  status: ItemStatus;
  error?: string;
  result?: TasteVideoResult;
}

function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = trimmed.match(p);
    if (match) return match[1];
  }
  return null;
}

function makeEmptyEntry(id: string): VideoEntry {
  return { id, url: '', watchedFully: false, status: 'pending' };
}

interface TasteOnboardingProps {
  onComplete: (profile: LearningProfile) => void;
  onClose: () => void;
}

type Phase = 'form' | 'analyzing' | 'done' | 'error';

export default function TasteOnboarding({ onComplete, onClose }: TasteOnboardingProps) {
  const [entries, setEntries] = useState<VideoEntry[]>(
    Array.from({ length: MIN_VIDEOS }, (_, i) => makeEmptyEntry(`v${i}`))
  );
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [successCount, setSuccessCount] = useState(0);

  const updateEntry = (id: string, patch: Partial<VideoEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, makeEmptyEntry(`v${prev.length}-${Date.now()}`)]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => (prev.length > MIN_VIDEOS ? prev.filter((e) => e.id !== id) : prev));
  };

  const filledEntries = entries.filter((e) => e.url.trim());
  const readyEntries = filledEntries.filter((e) => e.watchedFully && extractVideoId(e.url));
  const canSubmit = filledEntries.length >= MIN_VIDEOS && readyEntries.length === filledEntries.length;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPhase('analyzing');

    // Sequential, not parallel — keeps this from hammering Gemini with N
    // simultaneous video-clip requests at once (each is already 3 clips).
    for (const entry of entries) {
      const videoId = extractVideoId(entry.url);
      if (!videoId || !entry.watchedFully) continue;

      updateEntry(entry.id, { status: 'analyzing' });
      try {
        const res = await fetch('/api/analyze-taste-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        });
        const data = await res.json();
        if (!res.ok) {
          updateEntry(entry.id, { status: 'error', error: data?.error || `Server error ${res.status}` });
          continue;
        }
        updateEntry(entry.id, { status: 'done', result: data as TasteVideoResult });
      } catch (err: any) {
        updateEntry(entry.id, { status: 'error', error: err?.message || 'Network error' });
      }
    }

    setEntries((current) => {
      const results = current.filter((e) => e.status === 'done' && e.result).map((e) => e.result as TasteVideoResult);

      if (results.length === 0) {
        setPhase('error');
        setErrorMsg('Koi bhi video analyze nahi ho paaya. Links check karke phir try karo.');
        return current;
      }

      const signals = averageTasteSignals(results);
      const existingProfile = getLearningProfile();
      const merged = existingProfile ? mergeLearningProfile(existingProfile, signals) : buildFreshProfileFromTaste(signals, results.length);
      if (!existingProfile) saveLearningProfile(merged);

      setSuccessCount(results.length);
      setPhase('done');
      onComplete(merged);
      return current;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      onClick={phase === 'analyzing' ? undefined : onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full p-5 md:p-6 text-black dark:text-white max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-white/40">
            Video Taste · Alternative to quiz
          </span>
          {phase !== 'analyzing' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition text-sm flex-shrink-0"
            >
              ✕
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {phase === 'form' && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HintBubble id="video-providing" text="Share a video you've fully watched (45+ min) — we'll learn your style from it." />
              <h3 className="text-base md:text-lg font-semibold mb-1 leading-snug">
                Wo videos do jo aap pehle se pura dekh chuke ho
              </h3>
              <p className="text-xs text-gray-400 dark:text-white/40 mb-4">
                Kam se kam {MIN_VIDEOS} videos, har ek {MIN_DURATION_MINUTES}+ min ka — kisi bhi topic pe. Isse aapka
                learning style quiz se nahi, real videos se samjha jaata hai.
              </p>

              <div className="space-y-3 mb-4">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="border border-gray-200 dark:border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400 dark:text-white/40 w-5 flex-shrink-0">{i + 1}.</span>
                      <input
                        type="text"
                        value={entry.url}
                        onChange={(e) => updateEntry(entry.id, { url: e.target.value })}
                        placeholder="https://youtube.com/watch?v=..."
                        className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
                      />
                      {entries.length > MIN_VIDEOS && (
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="text-gray-300 dark:text-white/30 hover:text-red-400 text-xs flex-shrink-0 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {entry.url.trim() && (
                      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/50 pl-7 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entry.watchedFully}
                          onChange={(e) => updateEntry(entry.id, { watchedFully: e.target.checked })}
                          className="rounded"
                        />
                        Maine yeh video pura dekha hai
                        {!extractVideoId(entry.url) && (
                          <span className="text-red-400 ml-1">(link samajh nahi aaya)</span>
                        )}
                      </label>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addEntry}
                className="text-xs text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white transition mb-4"
              >
                + Ek aur video add karo
              </button>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full px-4 py-3.5 md:py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 text-sm font-semibold transition active:scale-[0.98]"
              >
                Analyze {filledEntries.length >= MIN_VIDEOS ? filledEntries.length : MIN_VIDEOS} Videos
              </button>
              {!canSubmit && filledEntries.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-white/40 mt-2 text-center">
                  Har video ke liye link valid ho aur "pura dekha hai" checked ho.
                </p>
              )}
            </motion.div>
          )}

          {phase === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2">
              <p className="text-sm text-gray-500 dark:text-white/50 mb-4 text-center">
                Videos analyze ho rahe hain — thoda time lagega...
              </p>
              <div className="space-y-2">
                {entries
                  .filter((e) => e.url.trim() && extractVideoId(e.url) && e.watchedFully)
                  .map((entry, i) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 text-xs p-2.5 rounded-lg bg-gray-50 dark:bg-white/5"
                    >
                      <span className="w-4 flex-shrink-0">
                        {entry.status === 'done' && '✅'}
                        {entry.status === 'error' && '⚠️'}
                        {entry.status === 'analyzing' && (
                          <span className="inline-block w-2 h-2 bg-black dark:bg-white rounded-full animate-pulse" />
                        )}
                        {entry.status === 'pending' && '⏳'}
                      </span>
                      <span className="flex-1 truncate text-gray-500 dark:text-white/50">
                        {entry.result?.title || `Video ${i + 1}`}
                      </span>
                      {entry.status === 'error' && (
                        <span className="text-red-400 text-[10px] flex-shrink-0">{entry.error}</span>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-sm font-medium mb-1">Profile update ho gaya</p>
              <p className="text-xs text-gray-400 dark:text-white/40 mb-5">
                {successCount} video{successCount === 1 ? '' : 's'} ke analysis se banaya gaya
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-medium hover:opacity-80 transition"
              >
                Done
              </button>
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center">
              <p className="text-sm text-red-500 dark:text-red-400 mb-4">{errorMsg}</p>
              <button
                onClick={() => setPhase('form')}
                className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                Phir Try Karo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
