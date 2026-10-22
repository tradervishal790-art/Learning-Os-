// Today's Current Affairs status on the dashboard home — one compact line.
// Shown ONLY for learners who have already finished at least one CA quiz, so people who
// do not study current affairs never see it (a daily nag for a feature they don't use
// would be worse than no reminder). It is deliberately NOT part of the "Get Started"
// checklist: that card hides for good once the 3 set-up steps are done, while this one
// is a daily thing.
import { Newspaper, Check } from 'lucide-react';
import { computeStreak, istDateKey, loadProgress } from './currentAffairsStore';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';

export default function CurrentAffairsChip({ onOpen }: { onOpen: () => void }) {
  const t = useTranslation();
  const progress = loadProgress();
  if (Object.keys(progress.quizzes).length === 0) return null;

  const today = progress.quizzes[istDateKey(0)];
  const streak = computeStreak(progress);
  const c = t.caChip;

  return (
    <div className="px-4 py-3 rounded-2xl card flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          today ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'border border-gray-300 dark:border-white/30 text-gray-400 dark:text-white/40'
        }`}
        aria-hidden
      >
        {today ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Newspaper className="w-4 h-4" strokeWidth={1.75} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {today ? format(c.doneTitle, today.score, today.total) : c.pendingTitle}
        </div>
        {streak > 0 && (
          <div className="text-xs text-gray-400 dark:text-white/40 truncate">{format(c.streak, streak)}</div>
        )}
      </div>
      {!today && (
        <button
          onClick={onOpen}
          className="px-3 py-1.5 rounded-full bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-xs font-medium hover:opacity-80 transition flex-shrink-0"
        >
          {c.cta}
        </button>
      )}
    </div>
  );
}
