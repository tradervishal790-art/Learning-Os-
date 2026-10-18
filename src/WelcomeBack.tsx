// "Welcome back" — a no-guilt return after a gap, with ONE tiny task.
// Shown on the dashboard home only when the learner was away 2+ days.
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Goal } from './types';
import type { TranslationShape } from './i18n/translations';
import { getDaysAway } from './behaviourStats';
import { getRevisionDataForGoals } from './revisionData';

const DISMISS_KEY = 'learning_os_welcome_back_dismissed';
const todayKey = () => new Date().toISOString().slice(0, 10);

interface Props {
  goals: Goal[];
  revisionTasks: TranslationShape['revisionTasks'];
  onOpen: (page: 'revision' | 'roadmap') => void;
}

export default function WelcomeBack({ goals, revisionTasks, onOpen }: Props) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === todayKey(); } catch { return false; }
  });
  const [daysAway] = useState(getDaysAway);
  if (hidden || daysAway < 2) return null;

  const items = getRevisionDataForGoals(revisionTasks, goals);
  const next = items.find((i) => i.status === 'overdue') ?? items.find((i) => i.status === 'due-today');
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch { /* best effort */ }
    setHidden(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl card"
    >
      <h3 className="font-semibold mb-1">Welcome back</h3>
      <p className="text-sm text-gray-500 dark:text-white/60 mb-4">
        {next
          ? `No pressure. Just one small thing: a quick revision of “${next.topic}”. Five minutes is enough.`
          : 'No pressure. Pick one topic from your roadmap and do just a little today.'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onOpen(next ? 'revision' : 'roadmap')}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white"
        >
          {next ? 'Start 5-min revision' : 'Open roadmap'}
        </button>
        <button onClick={dismiss} className="px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-white/50">
          Not now
        </button>
      </div>
    </motion.div>
  );
}
