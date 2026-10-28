// "Welcome back" — a no-guilt return after a gap, with ONE tiny task.
// Shown on the dashboard home only when the learner was away 2+ days.
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Goal } from './types';
import type { TranslationShape } from './i18n/translations';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
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
  const t = useTranslation().moments.welcomeBack;
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
      <h3 className="font-semibold mb-1">{t.title}</h3>
      <p className="text-sm text-gray-500 dark:text-white/60 mb-4">
        {next
          ? format(t.withTopic, next.topic)
          : t.noTopic}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onOpen(next ? 'revision' : 'roadmap')}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white"
        >
          {next ? t.startRevision : t.openRoadmap}
        </button>
        <button onClick={dismiss} className="px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-white/50">
          {t.notNow}
        </button>
      </div>
    </motion.div>
  );
}
