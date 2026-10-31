import { lazy, Suspense, useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { useNotebookIndex } from './notebookStore';
import { examChip, examSoon, examSortKey } from './studyInfo';

// Revision tab card: the student's own notes that need revising (status or exam date).
// Opens the note's Revision sheet right here.
const RevisionSheet = lazy(() => import('./RevisionSheet'));
const SHOW = 5;

export default function NotesToRevise() {
  const nt = useTranslation().notebook;
  const idx = useNotebookIndex();
  const [openId, setOpenId] = useState<string | null>(null);

  const due = useMemo(
    () =>
      idx.notes
        .filter((n) => !n.trashedAt && !n.archived && (n.status === 'needs-revision' || (n.status !== 'mastered' && examSoon(n.examDate))))
        .sort((a, b) => examSortKey(a.examDate) - examSortKey(b.examDate))
        .slice(0, SHOW),
    [idx.notes]
  );

  if (openId)
    return (
      <Suspense fallback={<div className="rounded-2xl border border-gray-200 dark:border-white/10 p-4 text-sm text-gray-500 dark:text-white/60" role="status" aria-live="polite">Opening your revision sheet…</div>}>
        <RevisionSheet id={openId} onBack={() => setOpenId(null)} />
      </Suspense>
    );
  if (due.length === 0) return null;

  return (
    <section className="mb-5 md:mb-8 rounded-2xl border border-gray-200 dark:border-white/10 p-4">
      <div className="flex items-center gap-2">
        <GraduationCap size={18} />
        <h2 className="font-semibold">{nt.rsheet.dueTitle}</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-white/60 mb-3">{nt.rsheet.dueHint}</p>
      <ul className="space-y-2">
        {due.map((n) => {
          const c = examChip(n.examDate);
          const when = !c ? '' : c.kind === 'today' ? nt.study.examToday : c.kind === 'tomorrow' ? nt.study.examTomorrow : c.kind === 'future' ? format(nt.study.examInDays, c.days) : format(nt.study.examPast, c.days);
          return (
            <li key={n.id}>
              <button
                onClick={() => setOpenId(n.id)}
                title={nt.rsheet.open}
                className="w-full text-left rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <span className="block text-sm font-medium truncate">{n.title || nt.untitled}</span>
                {when && <span className="block text-xs text-gray-500 dark:text-white/60">{when}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
