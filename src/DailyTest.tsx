import { useState, useRef } from 'react';
import { ArrowLeft, CalendarCheck, Download, Upload, Pencil, Trash2, Play } from 'lucide-react';
import type { TestPaper } from './types';
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

// ============================================================
// DailyTest.tsx — setup + "today's test" screen for the Daily Test feature
// (see dailyTestStore.ts for the rules). The test itself runs in the normal
// exam UI of Test.tsx: onStart(paper) hands today's paper over to it.
// ============================================================

export default function DailyTest({ onStart, onExit }: { onStart: (paper: TestPaper) => void; onExit: () => void }) {
  const [state, setState] = useState(() => loadDaily());
  const [editingBank, setEditingBank] = useState(false);
  const [message, setMessage] = useState('');
  const [perDayInput, setPerDayInput] = useState(String(state.perDay));
  const [minInput, setMinInput] = useState(String(state.minutesPerQuestion));
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setState(loadDaily());
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
          Add your photos/PDFs here (or paste / type questions). Every question needs its answer — then press <b>Save Question Bank</b>. You only do this once; the daily tests are made from it automatically.
        </p>
        <TestBuilder
          variant="daily"
          initialPaper={bankPaper}
          onCancel={() => setEditingBank(false)}
          onSave={(p) => {
            if (!saveBank(p.questions)) {
              alert('Could not save — your browser storage is full. Remove some questions or clear old data, then try again.');
              return;
            }
            setEditingBank(false);
            setMessage(`Question bank saved: ${p.questions.length} questions.`);
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

  const start = () => {
    const paper = getOrCreateTodayTest();
    if (!paper) return refresh();
    onStart(paper);
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
    setMessage(ok ? 'Backup restored.' : 'That file is not a valid Daily Test backup.');
    refresh();
    if (fileRef.current) fileRef.current.value = '';
  };
  const reset = () => {
    if (!confirm('Delete the whole question bank and all Daily Test progress? Your finished results stay in Past attempts.')) return;
    resetDaily();
    setMessage('');
    refresh();
  };

  const card = 'rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5 mb-5';
  const inputCls = 'w-24 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-black dark:focus:border-white';
  const btn = 'flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/20 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition';

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/60 mb-5 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to tests
      </button>
      <h2 className="flex items-center gap-2 text-2xl font-bold mb-1">
        <CalendarCheck className="w-6 h-6" /> Daily Test
      </h2>
      <p className="text-sm text-gray-500 dark:text-white/60 mb-6">Upload your questions once. A new test is ready for you every day — no daily uploading.</p>

      {message && <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

      {status === 'empty' ? (
        <div className={card}>
          <p className="font-semibold mb-1">Start by adding your questions</p>
          <p className="text-sm text-gray-500 dark:text-white/60 mb-4">Add photos or PDFs of your question paper (or paste/type the questions). You do this only once.</p>
          <button onClick={() => setEditingBank(true)} className="px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold">
            Add questions
          </button>
        </div>
      ) : (
        <>
          <div className={card}>
            {status === 'done' ? (
              <>
                <p className="font-semibold">Today's test is done ✅</p>
                <p className="text-sm text-gray-500 dark:text-white/60">Your next test will be ready tomorrow. See your result in Past attempts.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">{status === 'pending' ? (isMissed ? 'Your missed test is waiting' : "Today's test is ready") : "Today's test"}</p>
                <p className="text-sm text-gray-500 dark:text-white/60 mb-4">
                  {state.pending
                    ? `${state.pending.questions.length} questions${state.pending.durationMinutes > 0 ? ` · ${state.pending.durationMinutes} min` : ' · no timer'}${isMissed ? ' · same questions, not skipped' : ''}`
                    : `${Math.min(sum.perDay, sum.total)} questions${state.minutesPerQuestion > 0 ? ` · ${Math.max(1, Math.round(Math.min(sum.perDay, sum.total) * state.minutesPerQuestion))} min` : ' · no timer'}`}
                </p>
                <button onClick={start} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold">
                  <Play className="w-4 h-4" /> Start today's test
                </button>
              </>
            )}
          </div>

          <div className={card}>
            <p className="font-semibold mb-3">Settings</p>
            <div className="flex flex-wrap items-end gap-5">
              <label className="text-sm">
                <span className="block mb-1 text-gray-600 dark:text-white/70">Questions per day</span>
                <input type="number" min={1} max={MAX_PER_DAY} value={perDayInput} onChange={(e) => setPerDayInput(e.target.value)} onBlur={commitPerDay} className={inputCls} />
              </label>
              <label className="text-sm">
                <span className="block mb-1 text-gray-600 dark:text-white/70">Minutes per question (0 = no timer)</span>
                <input type="number" min={0} max={10} step={0.5} value={minInput} onChange={(e) => setMinInput(e.target.value)} onBlur={commitMinutes} className={inputCls} />
              </label>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-white/50">A changed number applies from the next test (a waiting test keeps its questions).</p>
          </div>

          <div className={card}>
            <p className="font-semibold mb-2">Your progress</p>
            <p className="text-sm text-gray-600 dark:text-white/70">
              {sum.total} questions in your bank · {sum.daysCompleted} daily test{sum.daysCompleted !== 1 ? 's' : ''} finished · round {sum.round}
            </p>
            <p className="text-sm text-gray-600 dark:text-white/70">
              {sum.left} questions not used yet in this round · about {sum.daysPerRound} days for the whole bank
            </p>
            {sum.wrongCount > 0 && <p className="text-sm text-gray-600 dark:text-white/70">{sum.wrongCount} questions you got wrong — they come first in the next round.</p>}
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <button onClick={() => setEditingBank(true)} className={btn}>
              <Pencil className="w-4 h-4" /> Edit question bank / add more photos
            </button>
            <button onClick={download} className={btn}>
              <Download className="w-4 h-4" /> Backup
            </button>
            <button onClick={() => fileRef.current?.click()} className={btn}>
              <Upload className="w-4 h-4" /> Restore
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
            <button onClick={reset} className={`${btn} text-red-500`}>
              <Trash2 className="w-4 h-4" /> Reset
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-white/50">
            Your question bank and daily tests are saved in this browser only. Clearing browser data erases them — use <b>Backup</b> now and then (and <b>Restore</b> on another device).
          </p>
        </>
      )}
    </div>
  );
}
