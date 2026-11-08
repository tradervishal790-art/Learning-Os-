import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, CalendarCheck, Download, Upload, Pencil, Trash2, Play } from 'lucide-react';
import type { TestPaper } from './types';
import { clearQueuedDailyPhotos, getQueuedPhotoCount, processQueuedPhotosForDailyTest } from './dailyPhotoQueue';
import { getReadyDailyQuestionCount } from './dailyTestStore';
import TestBuilder from './TestBuilder';
import {
  loadDaily,
  saveBank,
  setPerDay,
  setMinutesPerQuestion,
  resetDaily,
  getDailyStatus,
  getDailySummary,
  getOrCreateTodayTest,
  exportDailyBackup,
  importDailyBackup,
  todayKey,
  MAX_PER_DAY,
} from './dailyTestStore';
import { askConfirm, showNotice } from './dialogApi';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';

// ============================================================
// DailyTest.tsx — setup + "today's test" screen for the Daily Test feature
// (see dailyTestStore.ts for the rules). The test itself runs in the normal
// exam UI of Test.tsx: onStart(paper) hands today's paper over to it.
// ============================================================

export default function DailyTest({ onStart, onExit }: { onStart: (paper: TestPaper) => void; onExit: () => void }) {
  const t = useTranslation().dailyTest;
  const [state, setState] = useState(() => loadDaily());
  const [editingBank, setEditingBank] = useState(false);
  const [message, setMessage] = useState('');
  const [queuedPhotos, setQueuedPhotos] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [perDayInput, setPerDayInput] = useState(String(state.perDay));
  const [minInput, setMinInput] = useState(String(state.minutesPerQuestion));
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setState(loadDaily());
  useEffect(() => { void getQueuedPhotoCount().then(setQueuedPhotos); }, []);
  const status = getDailyStatus(state);
  const sum = getDailySummary(state);

  const bankPaper: TestPaper | null =
    state.bank.length > 0
      ? { id: 'daily-bank', title: 'Daily Test question bank', topic: 'Daily Test', durationMinutes: 0, questions: state.bank, createdAt: '', updatedAt: '' }
      : null;

  if (editingBank) {
    return (
      <div>
        <p className="max-w-3xl mx-auto mb-4 text-sm text-gray-500 dark:text-white/60">
          {t.queueHintBefore}<b>{t.saveBank}</b>{t.queueHintAfter}
        </p>
        <TestBuilder
          variant="daily"
          initialPaper={bankPaper}
          onCancel={() => setEditingBank(false)}
          onSave={(p) => {
            if (!saveBank(p.questions)) {
              void showNotice(t.bankFull);
              return;
            }
            setEditingBank(false);
            void getQueuedPhotoCount().then(setQueuedPhotos);
            setMessage(p.questions.length ? format(t.bankSaved, p.questions.length) : t.bankSavedQueued);
            refresh();
          }}
        />
      </div>
    );
  }

  const commitPerDay = () => {
    const n = Math.min(MAX_PER_DAY, Math.max(1, Math.round(Number(perDayInput)) || state.perDay));
    setPerDay(n);
    setPerDayInput(String(n));
    refresh();
  };
  const commitMinutes = () => {
    const n = Math.max(0, Number(minInput) || 0);
    setMinutesPerQuestion(n);
    setMinInput(String(Math.min(10, n)));
    refresh();
  };

  const start = async () => {
    if (preparing) return;
    setPreparing(true);
    setMessage('');
    let importFailed = false;
    try {
      let current = loadDaily();
      if (!current.pending && getReadyDailyQuestionCount(current.bank) < current.perDay && queuedPhotos > 0) {
        // A short remaining queue is normal near the end of a round. The
        // scheduler starts the next round itself; only read more files when
        // the whole ready bank is too small for one daily test.
        const result = await processQueuedPhotosForDailyTest(current.perDay, setMessage);
        setQueuedPhotos(result.remainingFiles);
        current = loadDaily();
        if (result.errors.length) {
          importFailed = true;
          setMessage(format(t.processedErr, result.processedPages, result.errors[0]));
        }
        else if (result.processedPages > 0) setMessage(format(t.processedPartial, result.processedPages, result.remainingFiles));
      }
      const paper = getOrCreateTodayTest();
      if (!paper) {
        refresh();
        if (getReadyDailyQuestionCount(current.bank) === 0 && !importFailed) setMessage(current.bank.length > 0 ? t.needAnswers : t.noneReady);
        return;
      }
      refresh();
      onStart(paper);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.prepareFailed);
      refresh();
    } finally {
      setPreparing(false);
    }
  };

  // A waiting test whose date is before today = a missed day: the same questions come back.
  const pendingDate = state.pending?.id.split('_')[1];
  const isMissed = !!state.pending && !!pendingDate && pendingDate < todayKey();

  const download = () => {
    const blob = new Blob([exportDailyBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-test-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    const ok = importDailyBackup(await file.text());
    setMessage(ok ? t.restored : t.badBackup);
    refresh();
    if (fileRef.current) fileRef.current.value = '';
  };
  const reset = async () => {
    if (!(await askConfirm(t.confirmReset, { danger: true }))) return;
    resetDaily();
    void clearQueuedDailyPhotos().then(() => setQueuedPhotos(0));
    setMessage('');
    refresh();
  };

  const card = 'rounded-2xl card p-5 mb-5';
  const inputCls = 'w-24 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-black dark:focus:border-white';
  const btn = 'flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/20 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition';

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onExit} className="flex min-h-11 items-center gap-1.5 text-sm text-gray-500 dark:text-white/60 mb-5 hover:underline">
        <ArrowLeft className="w-4 h-4" /> {t.backToTests}
      </button>
      <h2 className="flex items-center gap-2 text-2xl font-bold mb-1">
        <CalendarCheck className="w-6 h-6" /> {t.title}
      </h2>
      <p className="text-sm text-gray-500 dark:text-white/60 mb-6">{t.intro}</p>

      {message && <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

      {status === 'empty' && queuedPhotos === 0 ? (
        <div className={card}>
          <p className="font-semibold mb-1">{t.startTitle}</p>
          <p className="text-sm text-gray-500 dark:text-white/60 mb-4">{t.startBody}</p>
          <button onClick={() => setEditingBank(true)} className="min-h-11 px-5 py-2.5 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white font-semibold">
            {t.addQuestions}
          </button>
        </div>
      ) : (
        <>
          <div className={card}>
            {status === 'done' ? (
              <>
                <p className="font-semibold">{t.doneTitle}</p>
                <p className="text-sm text-gray-500 dark:text-white/60">{t.doneBody}</p>
              </>
            ) : (
              <>
                <p className="font-semibold">{status === 'pending' ? (isMissed ? t.statusMissed : t.statusReady) : state.bank.length === 0 ? t.statusPrepare : t.statusToday}</p>
                <p className="text-sm text-gray-500 dark:text-white/60 mb-4">
                  {state.pending
                    ? format(t.pendingLine, state.pending.questions.length, state.pending.durationMinutes > 0 ? format(t.minutesSuffix, state.pending.durationMinutes) : t.noTimer, isMissed ? t.sameQuestions : '')
                    : format(t.readyLine, Math.min(sum.perDay, sum.total), queuedPhotos, state.minutesPerQuestion > 0 ? format(t.upTo, Math.max(1, Math.round(Math.min(sum.perDay, Math.max(1, sum.total)) * state.minutesPerQuestion))) : t.noTimer)}
                </p>
                <button onClick={start} disabled={preparing} className="flex min-h-11 items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white font-semibold disabled:opacity-50">
                  <Play className="w-4 h-4" /> {preparing ? t.preparing : t.startToday}
                </button>
              </>
            )}
          </div>

          <div className={card}>
            <p className="font-semibold mb-3">{t.settings}</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 sm:gap-5">
              <label className="text-sm">
                <span className="block mb-1 text-gray-600 dark:text-white/70">{t.perDay}</span>
                <input type="number" min={1} max={MAX_PER_DAY} value={perDayInput} onChange={(e) => setPerDayInput(e.target.value)} onBlur={commitPerDay} className={inputCls} />
              </label>
              <label className="text-sm">
                <span className="block mb-1 text-gray-600 dark:text-white/70">{t.minPerQ}</span>
                <input type="number" min={0} max={10} step={0.5} value={minInput} onChange={(e) => setMinInput(e.target.value)} onBlur={commitMinutes} className={inputCls} />
              </label>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-white/50">{t.settingsNote}</p>
          </div>

          <div className={card}>
            <p className="font-semibold mb-2">{t.progress}</p>
            <p className="text-sm text-gray-600 dark:text-white/70">
              {format(t.progressLine1, sum.total, queuedPhotos, sum.daysCompleted, sum.round)}
            </p>
            <p className="text-sm text-gray-600 dark:text-white/70">
              {format(t.progressLine2, sum.left, sum.daysPerRound)}
            </p>
            {sum.wrongCount > 0 && <p className="text-sm text-gray-600 dark:text-white/70">{format(t.wrongLine, sum.wrongCount)}</p>}
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <button onClick={() => setEditingBank(true)} className={btn}>
              <Pencil className="w-4 h-4" /> {t.editBank}
            </button>
            <button onClick={download} className={btn}>
              <Download className="w-4 h-4" /> {t.backup}
            </button>
            <button onClick={() => fileRef.current?.click()} className={btn}>
              <Upload className="w-4 h-4" /> {t.restore}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
            <button onClick={reset} className={`${btn} text-red-500`}>
              <Trash2 className="w-4 h-4" /> {t.reset}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-white/50">
            {t.footerBefore}<b>{t.backup}</b>{t.footerMid}<b>{t.restore}</b>{t.footerAfter}
          </p>
        </>
      )}
    </div>
  );
}
