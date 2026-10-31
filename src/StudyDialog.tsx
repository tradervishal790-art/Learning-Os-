import { useEffect, useState } from 'react';
import { useTranslation } from './i18n/LanguageContext';
import { STUDY_STATUSES } from './studyInfo';
import type { NoteMeta, StudyStatus } from './notebookStore';

/** Study details of ONE note: status, confidence (1-5) and exam date. Saved only when the student presses Save. */
export default function StudyDialog({
  note, onSave, onClose,
}: {
  note: NoteMeta;
  onSave: (v: { status: StudyStatus; confidence: number; examDate: string | null }) => void;
  onClose: () => void;
}) {
  const t = useTranslation().notebook;
  const [status, setStatus] = useState<StudyStatus>(note.status ?? 'not-started');
  const [confidence, setConfidence] = useState<number>(note.confidence ?? 0);
  const [date, setDate] = useState<string>(note.examDate ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label: Record<StudyStatus, string> = {
    'not-started': t.study.statusNotStarted,
    learning: t.study.statusLearning,
    'needs-revision': t.study.statusNeedsRevision,
    mastered: t.study.statusMastered,
  };
  const chip = () => 'los-chip';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.study.details}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-5 space-y-5 shadow-2xl shadow-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold truncate">{note.title || t.untitled}</div>

        <div>
          <div className="text-xs text-gray-500 dark:text-white/60 mb-2">{t.study.statusLabel}</div>
          <div className="flex flex-wrap gap-2">
            {STUDY_STATUSES.map((s) => (
              <button key={s} aria-pressed={status === s} className={chip()} onClick={() => setStatus(s)}>
                {label[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 dark:text-white/60 mb-2">{t.study.confidenceLabel}</div>
          <div className="flex flex-wrap gap-2">
            <button aria-pressed={confidence === 0} className={chip()} onClick={() => setConfidence(0)}>
              {t.study.confidenceNone}
            </button>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-pressed={confidence === n} className={`${chip()} min-w-9`} onClick={() => setConfidence(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-white/60 block mb-2" htmlFor="study-exam-date">
            {t.study.examDateLabel}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="study-exam-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 px-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-sm"
            />
            {date && (
              <button className={chip()} onClick={() => setDate('')}>
                {t.study.clearDate}
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className={chip()} onClick={onClose}>
            {t.cancel}
          </button>
          <button className="los-btn los-btn-primary" onClick={() => onSave({ status, confidence, examDate: date || null })}>
            {t.study.save}
          </button>
        </div>
      </div>
    </div>
  );
}
