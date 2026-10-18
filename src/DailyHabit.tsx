// "Today's habit" — one small action a day on the dashboard home, picked from the
// learner's Personality Check (on-device, no AI). Shown only when the result has a clear
// leaning. Either button hides it until tomorrow.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { getPersonalityProfile } from './personalityProfileStore';
import { buildDailyHabit } from './personalityBrief';

const KEY = 'learning_os_daily_habit_hidden';
const dateKey = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

export default function DailyHabit() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === dateKey(); } catch { return false; }
  });
  const [habit] = useState(() => buildDailyHabit(getPersonalityProfile(), Math.floor(Date.now() / 86_400_000)));
  const [done, setDone] = useState(false);
  if (hidden || !habit) return null;

  const close = (wasDone: boolean) => {
    try { localStorage.setItem(KEY, dateKey()); } catch { /* best effort */ }
    if (wasDone) {
      setDone(true);
      setTimeout(() => setHidden(true), 1800);
    } else {
      setHidden(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5"
    >
      <p className="text-[11px] uppercase tracking-widest text-purple-500">Today's habit</p>
      {done ? (
        <p className="text-sm font-medium mt-1">Nice one. See you tomorrow.</p>
      ) : (
        <>
          <p className="text-sm font-medium mt-1 leading-relaxed">{habit}</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => close(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white"
            >
              Done
            </button>
            <button onClick={() => close(false)} className="px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-white/50">
              Not today
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
