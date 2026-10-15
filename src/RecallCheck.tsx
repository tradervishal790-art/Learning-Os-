// "Prove it" step after a video: write what you remember BEFORE the next one starts.
// Free recall (no looking back) is the point — it turns "that felt clear" into
// "I can actually say it". Always skippable; saved on-device only.
import { useState } from 'react';
import { motion } from 'framer-motion';

const KEY = 'learning_os_recall_checks';

export interface RecallEntry { videoId: string; text: string; at: string }

export function getRecallEntries(): RecallEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as RecallEntry[];
  } catch {
    return [];
  }
}

function saveRecall(entry: RecallEntry) {
  try {
    const all = getRecallEntries();
    all.push(entry);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    // best effort
  }
}

export default function RecallCheck({ videoId, onDone }: { videoId: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const ready = text.trim().length >= 15;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5"
    >
      <h3 className="font-semibold mb-1">Quick recall — before the next video</h3>
      <p className="text-sm text-gray-500 dark:text-white/60 mb-3">
        Without scrolling back, write the 2–3 main things you remember. Even half-right is fine — this is what makes it stick.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What I remember…"
        className="w-full rounded-xl border border-gray-300 dark:border-white/20 bg-transparent p-3 text-sm outline-none focus:border-black dark:focus:border-white"
      />
      <div className="flex gap-2 mt-3">
        <button
          disabled={!ready}
          onClick={() => {
            saveRecall({ videoId, text: text.trim(), at: new Date().toISOString() });
            onDone();
          }}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-black text-white dark:bg-white dark:text-black disabled:opacity-40"
        >
          Done — next video
        </button>
        <button onClick={onDone} className="px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-white/50">
          Skip
        </button>
      </div>
    </motion.div>
  );
}
