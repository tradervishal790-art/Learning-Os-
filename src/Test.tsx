import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RotateCcw, CheckCircle2, XCircle, HelpCircle, History, Plus, Pencil, Trash2, Clock, Flag, Users, CalendarCheck, ChevronRight, Play, ChevronLeft } from 'lucide-react';
import type { TestPaper, TestQuestion, TestUserAnswer, TestAttempt, MCQQuestion, SubjectiveQuestion } from './types';
import { getTestPapers, saveTestPaper, deleteTestPaper, hydrateTestBankFromCloud } from './testBankStore';
import { OFFICIAL_TESTS } from './officialTests';
import { getTestAttempts, saveTestAttempt, updateTestAttempt, hydrateTestAttemptsFromCloud } from './testStore';
import { buildInitialResults, selfGradeSubjective, computeTotalMarks, computeObtainedMarks, computeScorePercent, pendingSelfGradeCount, isAnswered } from './testGrading';
import { downloadTestResultPdf } from './testPdf';
import TestBuilder from './TestBuilder';
import TestAnalysis from './TestAnalysis';
import LiveHost from './LiveHost';
import { loadDraft, saveDraft, clearDraft } from './testDraft';
import DailyTest from './DailyTest';
import ConfirmDialog from './ConfirmDialog';
import { setImmersive } from './immersive';
import { completeDailyTest, isDailyPaper, getDailyStatus } from './dailyTestStore';
import { contributeQuestionPatterns } from './sharedLearningPatterns';
import SharedLearningInsights from './SharedLearningInsights';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { GlassButton, GlassPanel, ProgressRing } from './ui/kit';

// ============================================================
// Test.tsx — "Test" tab (Dashboard renders <Test /> with no props).
// Every question is authored by hand in TestBuilder.tsx and stored in
// testBankStore.ts. AI is used in exactly two places: reading questions/answers
// from photos/PDFs (PhotoImport.tsx), and ONE study suggestion on the results
// screen (TestAnalysis.tsx, button press only). All other analysis is on-device. Flow:
//   list         → pick a saved test paper, or create/edit/delete one
//   instructions → duration, marking scheme, palette legend, Start
//   taking       → NTA/JEE-Main-style exam UI: timer, question palette,
//                  Save & Next / Mark for Review / Clear Response
//   results      → score, self-grade subjective answers, PDF export
// ============================================================

type Stage = 'list' | 'builder' | 'instructions' | 'taking' | 'results' | 'live' | 'daily';
export type QuestionStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function Test() {
  const tt = useTranslation().testScreen;
  // Resume an unfinished test after refresh / tab close (see testDraft.ts).
  const [draft] = useState(() => loadDraft());
  const [stage, setStage] = useState<Stage>(draft ? 'taking' : 'list');
  // In-app confirm boxes (native confirm() is unreliable in in-app browsers / installed PWAs).
  const [submitPrompt, setSubmitPrompt] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<string | null>(null);
  // Hide the mobile bottom bar while a timed test is running.
  useEffect(() => {
    setImmersive(stage === 'taking');
    return () => setImmersive(false);
  }, [stage]);
  const [papers, setPapers] = useState<TestPaper[]>([]);
  const [history, setHistory] = useState<TestAttempt[]>([]);
  const [editingPaper, setEditingPaper] = useState<TestPaper | null>(null);
  const [livePaper, setLivePaper] = useState<TestPaper | null>(null);
  const [activePaper, setActivePaper] = useState<TestPaper | null>(draft?.paper ?? null);

  // ── taking-stage state ──────────────────────────────────────────────
  const [step, setStep] = useState(draft?.step ?? 0);
  const [answers, setAnswers] = useState<TestUserAnswer[]>(draft?.answers ?? []);
  const [statusMap, setStatusMap] = useState<Record<string, QuestionStatus>>((draft?.statusMap as Record<string, QuestionStatus>) ?? {});
  // Wall-clock start time: the timer is derived from this, not from counting
  // interval ticks (browsers throttle intervals in background tabs).
  const startedAtRef = useRef<number>(draft?.startedAt ?? 0);
  const [secondsElapsed, setSecondsElapsed] = useState(draft ? Math.floor((Date.now() - draft.startedAt) / 1000) : 0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);

  // Refs mirror the latest state so submitTest (called from the timer
  // effect, which only re-subscribes when `stage`/`timeLeft` change) always
  // reads the current paper/answers/elapsed time instead of a stale closure.
  const activePaperRef = useRef(activePaper);
  const answersRef = useRef(answers);
  useEffect(() => {
    activePaperRef.current = activePaper;
  }, [activePaper]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const refresh = useCallback(() => {
    setPapers(getTestPapers());
    setHistory(getTestAttempts());
  }, []);

  useEffect(() => {
    refresh();
  }, [stage, refresh]);

  // ON-DEMAND CLOUD HYDRATION: only pulled down when the Test page is
  // actually opened (once), not upfront on sign-in. No-op if this device
  // already has test attempts/papers.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void Promise.all([hydrateTestAttemptsFromCloud(), hydrateTestBankFromCloud()]).then(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'taking') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => setSecondsElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  // Persist progress on every change while taking a test.
  useEffect(() => {
    if (stage !== 'taking' || !activePaper) return;
    saveDraft({ paper: activePaper, answers, statusMap, step, startedAt: startedAtRef.current });
  }, [stage, activePaper, answers, statusMap, step]);

  const timeLimitSeconds = (activePaper?.durationMinutes ?? 0) * 60;
  const timeLeft = timeLimitSeconds > 0 ? timeLimitSeconds - secondsElapsed : null;

  // ── test bank actions ────────────────────────────────────────────────
  const openCreate = () => {
    setEditingPaper(null);
    setStage('builder');
  };
  const openEdit = (p: TestPaper) => {
    setEditingPaper(p);
    setStage('builder');
  };
  const handleSavePaper = (p: TestPaper) => {
    saveTestPaper(p);
    setStage('list');
  };
  const handleDeletePaper = (id: string) => {
    setDeletePrompt(id);
  };

  // ── taking a test ────────────────────────────────────────────────────
  const startInstructions = (p: TestPaper) => {
    setActivePaper(p);
    setStage('instructions');
  };

  const startLive = (p: TestPaper) => {
    setLivePaper(p);
    setStage('live');
  };

  const beginTest = () => {
    if (!activePaper) return;
    const initialAnswers: TestUserAnswer[] = activePaper.questions.map((q) =>
      q.type === 'mcq' ? { questionId: q.id, type: 'mcq', selectedIndex: null } : { questionId: q.id, type: 'subjective', text: '' }
    );
    const initialStatus: Record<string, QuestionStatus> = {};
    activePaper.questions.forEach((q, i) => {
      initialStatus[q.id] = i === 0 ? 'not-answered' : 'not-visited';
    });
    setAnswers(initialAnswers);
    setStatusMap(initialStatus);
    setStep(0);
    startedAtRef.current = Date.now();
    setSecondsElapsed(0);
    setStage('taking');
  };

  const currentQuestion: TestQuestion | undefined = activePaper?.questions[step];
  const currentAnswer = currentQuestion ? answers.find((a) => a.questionId === currentQuestion.id) : undefined;

  const goToStep = (index: number) => {
    if (!activePaper) return;
    const q = activePaper.questions[index];
    setStatusMap((prev) => ({ ...prev, [q.id]: prev[q.id] === 'not-visited' ? 'not-answered' : prev[q.id] }));
    setStep(index);
  };

  const selectMCQ = (index: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => prev.map((a) => (a.questionId === currentQuestion.id ? { ...a, type: 'mcq', selectedIndex: index } : a)));
  };
  const setSubjectiveText = (text: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => prev.map((a) => (a.questionId === currentQuestion.id ? { ...a, type: 'subjective', text } : a)));
  };

  const saveAndNext = () => {
    if (!currentQuestion || !activePaper) return;
    const answered = isAnswered(currentAnswer);
    setStatusMap((prev) => ({ ...prev, [currentQuestion.id]: answered ? 'answered' : 'not-answered' }));
    if (step < activePaper.questions.length - 1) goToStep(step + 1);
  };

  const markForReviewAndNext = () => {
    if (!currentQuestion || !activePaper) return;
    const answered = isAnswered(currentAnswer);
    setStatusMap((prev) => ({ ...prev, [currentQuestion.id]: answered ? 'answered-marked' : 'marked' }));
    if (step < activePaper.questions.length - 1) goToStep(step + 1);
  };

  const clearResponse = () => {
    if (!currentQuestion) return;
    setAnswers((prev) =>
      prev.map((a) =>
        a.questionId === currentQuestion.id ? (a.type === 'mcq' ? { ...a, selectedIndex: null } : { ...a, text: '' }) : a
      )
    );
    setStatusMap((prev) => ({ ...prev, [currentQuestion.id]: 'not-answered' }));
  };

  const submitTest = useCallback(() => {
    const paper = activePaperRef.current;
    if (!paper) return;
    const currentAnswers = answersRef.current;
    const limit = paper.durationMinutes * 60;
    const rawTaken = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
    const timeTaken = limit > 0 ? Math.min(rawTaken, limit) : rawTaken;
    clearDraft();
    const results = buildInitialResults(paper.questions, currentAnswers);
    const totalMarks = computeTotalMarks(paper.questions);
    const obtainedMarks = computeObtainedMarks(results);
    const newAttempt: TestAttempt = {
      id: `attempt_${Date.now()}`,
      testId: paper.id,
      testTitle: paper.title,
      topic: paper.topic,
      completedAt: new Date().toISOString(),
      timeTakenSeconds: timeTaken,
      questions: paper.questions,
      answers: currentAnswers,
      results,
      totalMarks,
      obtainedMarks,
      scorePercent: computeScorePercent(obtainedMarks, totalMarks),
    };
    saveTestAttempt(newAttempt);
    void contributeQuestionPatterns([...getTestAttempts().filter((saved) => saved.id !== newAttempt.id), newAttempt]);
    if (isDailyPaper(paper.id)) completeDailyTest(paper.id, results);
    setAttempt(newAttempt);
    setStage('results');
  }, []);

  useEffect(() => {
    if (stage === 'taking' && timeLeft !== null && timeLeft <= 0) {
      submitTest();
    }
  }, [timeLeft, stage, submitTest]);

  const confirmSubmit = () => {
    const unanswered = activePaper ? activePaper.questions.length - answers.filter((a) => isAnswered(a)).length : 0;
    const msg = unanswered > 0 ? format(tt.confirm.unanswered, unanswered) : tt.confirm.submitNow;
    setSubmitPrompt(msg);
  };

  const startOver = () => {
    setStage('list');
    setActivePaper(null);
    setAttempt(null);
  };

  const openPastAttempt = (a: TestAttempt) => {
    setAttempt(a);
    setStage('results');
  };

  const handleSelfGrade = (questionId: string, isCorrect: boolean, marks: number) => {
    if (!attempt) return;
    const results = selfGradeSubjective(attempt.results, questionId, isCorrect, marks);
    const obtainedMarks = computeObtainedMarks(results);
    const updated: TestAttempt = { ...attempt, results, obtainedMarks, scorePercent: computeScorePercent(obtainedMarks, attempt.totalMarks) };
    updateTestAttempt(updated);
    void contributeQuestionPatterns([...getTestAttempts().filter((saved) => saved.id !== updated.id), updated]);
    setAttempt(updated);
  };

  const handleSaveInsight = (insight: string) => {
    if (!attempt) return;
    const updated: TestAttempt = { ...attempt, insight };
    updateTestAttempt(updated);
    setAttempt(updated);
  };

  const stageBlobs = (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hidden md:block absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-500/[0.09] blur-[120px]" />
      <div className="hidden md:block absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-violet-600/[0.10] blur-[120px]" />
    </div>
  );

  const confirmDialogs = (
    <>
      {submitPrompt && (
        <ConfirmDialog
          message={submitPrompt}
          confirmLabel={tt.confirm.submit}
          cancelLabel={tt.confirm.keepWorking}
          onConfirm={() => { setSubmitPrompt(null); submitTest(); }}
          onCancel={() => setSubmitPrompt(null)}
        />
      )}
      {deletePrompt && (
        <ConfirmDialog
          message={tt.confirm.deleteMessage}
          confirmLabel={tt.confirm.delete}
          cancelLabel={tt.confirm.cancel}
          danger
          onConfirm={() => { deleteTestPaper(deletePrompt); setDeletePrompt(null); refresh(); }}
          onCancel={() => setDeletePrompt(null)}
        />
      )}
    </>
  );

  // The exam view is its own full dark stage; every other stage shares one dark stage with the page heading.
  if (stage === 'taking' && activePaper && currentQuestion) {
    return (
      <div className="dark p-2 md:p-4">
        <TakingScreen
          paper={activePaper}
          step={step}
          currentQuestion={currentQuestion}
          currentAnswer={currentAnswer}
          answers={answers}
          statusMap={statusMap}
          timeLeft={timeLeft}
          secondsElapsed={secondsElapsed}
          onGoToStep={goToStep}
          onSelectMCQ={selectMCQ}
          onSubjectiveText={setSubjectiveText}
          onSaveAndNext={saveAndNext}
          onMarkForReview={markForReviewAndNext}
          onClearResponse={clearResponse}
          onSubmit={confirmSubmit}
        />
        {confirmDialogs}
      </div>
    );
  }

  return (
    <div className="dark">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-none bg-transparent md:bg-[#080d19] px-4 pb-4 pt-2 text-slate-100 md:mb-4 md:mt-0 md:rounded-3xl md:px-8 md:pb-8 md:pt-3">
        {stageBlobs}
        <div className="relative">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`mb-5 md:mb-8 ${stage === 'list' ? '' : 'mx-auto max-w-3xl'}`}>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight md:text-4xl">{tt.title}</h1>
            <p className="text-sm text-slate-400">{tt.subtitle}</p>
          </motion.div>

          {stage === 'list' && (
            <>
              <SharedLearningInsights kind="questions" />
              <TestList
                papers={papers}
                history={history}
                onCreate={openCreate}
                onEdit={openEdit}
                onDelete={handleDeletePaper}
                onTake={startInstructions}
                onLive={startLive}
                onDaily={() => setStage('daily')}
                onOpenAttempt={openPastAttempt}
              />
            </>
          )}

          {stage === 'daily' && <DailyTest onStart={startInstructions} onExit={() => setStage('list')} />}

          {stage === 'live' && livePaper && <LiveHost paper={livePaper} onExit={() => setStage('list')} />}

          {stage === 'builder' && <TestBuilder initialPaper={editingPaper} onSave={handleSavePaper} onCancel={() => setStage('list')} />}

          {stage === 'instructions' && activePaper && <Instructions paper={activePaper} onStart={beginTest} onBack={() => setStage(isDailyPaper(activePaper.id) ? 'daily' : 'list')} />}

          {stage === 'results' && attempt && (
            <ResultsDashboard attempt={attempt} allAttempts={history} onSaveInsight={handleSaveInsight} onSelfGrade={handleSelfGrade} onRetake={startOver} />
          )}
        </div>
      </div>
      {confirmDialogs}
    </div>
  );
}

// ============================================================
// List screen: saved test papers + past attempt history
// ============================================================
function PaperRow({ p, children }: { p: TestPaper; children: ReactNode }) {
  const tt = useTranslation().testScreen;
  const count = p.questions.length;
  return (
    <GlassPanel accent="#67e8f9">
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{p.title}</p>
          <p className="text-xs text-slate-500">
            {p.topic} · {format(count === 1 ? tt.list.questionsOne : tt.list.questionsMany, count)} · {p.durationMinutes > 0 ? format(tt.list.minutes, p.durationMinutes) : tt.list.noTimer}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center justify-end gap-1.5 md:gap-2">{children}</div>
      </div>
    </GlassPanel>
  );
}

function TestList({
  papers,
  history,
  onCreate,
  onEdit,
  onDelete,
  onTake,
  onLive,
  onDaily,
  onOpenAttempt,
}: {
  papers: TestPaper[];
  history: TestAttempt[];
  onCreate: () => void;
  onEdit: (p: TestPaper) => void;
  onDelete: (id: string) => void;
  onTake: (p: TestPaper) => void;
  onLive: (p: TestPaper) => void;
  onDaily: () => void;
  onOpenAttempt: (a: TestAttempt) => void;
}) {
  const tt = useTranslation().testScreen;
  const dailyStatus = getDailyStatus();
  const dailyLabel = { empty: tt.list.dailyEmpty, pending: tt.list.dailyPending, ready: tt.list.dailyReady, done: tt.list.dailyDone }[dailyStatus];
  const liveButton = (p: TestPaper) => (
    <button onClick={() => onLive(p)} className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/15 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:h-auto md:rounded-lg md:px-3 md:py-2" title={tt.list.runLive} aria-label={tt.list.runLive}>
      <Users className="h-4 w-4" /><span className="hidden md:inline">{tt.list.live}</span>
    </button>
  );
  const takeButton = (p: TestPaper) => (
    <button onClick={() => onTake(p)} className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-cyan-300 text-sm font-semibold text-slate-900 shadow-[0_0_18px_rgba(103,232,249,.35)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:h-auto md:rounded-lg md:px-4 md:py-2" title={tt.list.takeTest} aria-label={tt.list.takeTest}>
      <Play className="h-4 w-4" fill="currentColor" /><span className="hidden md:inline">{tt.list.takeTest}</span>
    </button>
  );
  return (
    <div className="w-full">
      <GlassButton onClick={onDaily} accent="#a78bfa" className="mb-6 w-full border-violet-300/25 bg-gradient-to-r from-violet-500/[0.14] to-transparent md:mb-8">
        <span className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200"><CalendarCheck className="h-6 w-6" strokeWidth={1.75} /></span>
            <span className="min-w-0">
              <span className="block font-semibold text-white">{tt.list.dailyTitle}</span>
              <span className="block text-xs text-slate-400">{dailyLabel}</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 flex-shrink-0 text-violet-300" aria-label={tt.list.open} />
        </span>
      </GlassButton>

      {OFFICIAL_TESTS.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">{tt.list.officialTests}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {OFFICIAL_TESTS.map((p) => (
              <PaperRow key={p.id} p={p}>{liveButton(p)}{takeButton(p)}</PaperRow>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-slate-400">{tt.list.myTests}</h2>
      <button
        onClick={onCreate}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-300/40 bg-cyan-300/[0.06] py-3.5 font-semibold text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:mb-8"
      >
        <Plus className="h-4 w-4" /> {tt.list.createNew}
      </button>

      {papers.length === 0 ? (
        <p className="mb-10 text-center text-slate-500">{tt.list.noTestsYet}</p>
      ) : (
        <div className="mb-10 grid gap-3 lg:grid-cols-2">
          {papers.map((p) => (
            <PaperRow key={p.id} p={p}>
              <button onClick={() => onEdit(p)} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 md:h-auto md:w-auto md:rounded-lg md:p-2" aria-label={tt.list.editTest} title={tt.list.editTest}>
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => onDelete(p.id)} className="flex h-11 w-11 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 md:h-auto md:w-auto md:rounded-lg md:p-2" aria-label={tt.list.deleteTest} title={tt.list.deleteTest}>
                <Trash2 className="h-4 w-4" />
              </button>
              {liveButton(p)}
              {takeButton(p)}
            </PaperRow>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-400">
            <History className="h-4 w-4" /> {tt.list.pastAttempts}
          </h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {history.slice(0, 8).map((a) => (
              <button
                key={a.id}
                onClick={() => onOpenAttempt(a)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-left transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <span>
                  <span className="block font-medium text-white">{a.testTitle}</span>
                  <span className="block text-xs text-slate-500">{new Date(a.completedAt).toLocaleString()}</span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${a.scorePercent >= 60 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {a.obtainedMarks}/{a.totalMarks}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Instructions screen — shown once, before the timer starts
// ============================================================
function Instructions({ paper, onStart, onBack }: { paper: TestPaper; onStart: () => void; onBack: () => void }) {
  const tt = useTranslation().testScreen;
  const totalMarks = computeTotalMarks(paper.questions);
  const mcqCount = paper.questions.filter((q) => q.type === 'mcq').length;
  const subjCount = paper.questions.length - mcqCount;
  const tiles = [
    { label: tt.instructions.duration, value: paper.durationMinutes > 0 ? format(tt.list.minutes, paper.durationMinutes) : tt.instructions.noLimit },
    { label: tt.instructions.totalMarks, value: String(totalMarks) },
    { label: tt.instructions.mcq, value: String(mcqCount) },
    { label: tt.instructions.subjective, value: String(subjCount) },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <GlassPanel accent="#67e8f9">
        <div className="p-5 md:p-8">
          <h2 className="mb-1 text-2xl font-semibold text-white">{paper.title}</h2>
          <p className="mb-6 text-slate-400">{paper.topic}</p>

          <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-slate-500">{tile.label}</p>
                <p className="text-lg font-semibold tabular-nums text-white">{tile.value}</p>
              </div>
            ))}
          </div>

          <h3 className="mb-3 text-sm font-semibold text-slate-300">{tt.instructions.legendTitle}</h3>
          <div className="mb-8 space-y-2 text-sm">
            <LegendRow color="border-white/15 bg-white/[0.03]" label={tt.instructions.notVisited} />
            <LegendRow color="border-orange-400 bg-orange-400/10" label={tt.instructions.notAnswered} />
            <LegendRow color="border-emerald-400 bg-emerald-400/10" label={tt.instructions.answered} />
            <LegendRow color="border-violet-400 bg-violet-400/10" label={tt.instructions.marked} />
            <LegendRow color="border-violet-400 bg-violet-400/10" label={tt.instructions.answeredMarked} dot />
          </div>

          <div className="flex gap-3">
            <button onClick={onStart} className="flex-1 rounded-xl bg-cyan-300 py-3 font-semibold text-slate-900 shadow-[0_0_22px_rgba(103,232,249,.35)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {tt.instructions.start}
            </button>
            <button onClick={onBack} className="rounded-xl border border-white/15 px-6 py-3 font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              {tt.instructions.back}
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function LegendRow({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`relative h-5 w-5 flex-shrink-0 rounded-full border-2 ${color}`}>
        {dot && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#080d19] bg-emerald-400" />}
      </span>
      <span className="text-slate-300">{label}</span>
    </div>
  );
}

// ============================================================
// Taking screen — timer, stats strip, question palette, question, nav buttons
// (also used by LiveJoin, so it carries its own dark stage)
// ============================================================
export function TakingScreen({
  paper,
  step,
  currentQuestion,
  currentAnswer,
  answers,
  statusMap,
  timeLeft,
  secondsElapsed,
  onGoToStep,
  onSelectMCQ,
  onSubjectiveText,
  onSaveAndNext,
  onMarkForReview,
  onClearResponse,
  onSubmit,
}: {
  paper: TestPaper;
  step: number;
  currentQuestion: TestQuestion;
  currentAnswer: TestUserAnswer | undefined;
  answers: TestUserAnswer[];
  statusMap: Record<string, QuestionStatus>;
  timeLeft: number | null;
  secondsElapsed: number;
  onGoToStep: (i: number) => void;
  onSelectMCQ: (i: number) => void;
  onSubjectiveText: (t: string) => void;
  onSaveAndNext: () => void;
  onMarkForReview: () => void;
  onClearResponse: () => void;
  onSubmit: () => void;
}) {
  const tt = useTranslation().testScreen;
  const statusTone: Record<QuestionStatus, string> = {
    'not-visited': 'border-white/15 bg-white/[0.03] text-slate-400',
    'not-answered': 'border-orange-400 bg-orange-400/10 text-orange-300',
    answered: 'border-emerald-400 bg-emerald-400/10 text-emerald-300',
    marked: 'border-violet-400 bg-violet-400/10 text-violet-200',
    'answered-marked': 'border-violet-400 bg-violet-400/10 text-violet-200',
  };
  const statusLabel: Record<QuestionStatus, string> = {
    'not-visited': tt.taking.statusAria.notVisited,
    'not-answered': tt.taking.statusAria.notAnswered,
    answered: tt.taking.statusAria.answered,
    marked: tt.taking.statusAria.marked,
    'answered-marked': tt.taking.statusAria.answeredMarked,
  };

  const total = paper.questions.length;
  const isLast = step === total - 1;
  const lowTime = timeLeft !== null && timeLeft <= 60;
  const answeredCount = answers.filter((a) => isAnswered(a)).length;
  const statuses = paper.questions.map((q) => statusMap[q.id] ?? 'not-visited');
  const markedCount = statuses.filter((s) => s === 'marked' || s === 'answered-marked').length;
  const skippedCount = statuses.filter((s) => s === 'not-answered').length;
  const totalSeconds = paper.durationMinutes * 60;
  const timeFraction = timeLeft !== null && totalSeconds > 0 ? Math.max(0, Math.min(1, timeLeft / totalSeconds)) : null;
  const stats = [
    { label: tt.taking.statQuestions, value: total, tone: 'text-white' },
    { label: tt.taking.statAnswered, value: answeredCount, tone: 'text-emerald-300' },
    { label: tt.taking.statMarked, value: markedCount, tone: 'text-violet-300' },
    { label: tt.taking.statSkipped, value: skippedCount, tone: 'text-orange-300' },
  ];

  return (
    <div className="dark">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-transparent md:bg-[#080d19] p-3 text-slate-100 md:p-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hidden md:block absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-500/[0.09] blur-[120px]" />
          <div className="hidden md:block absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-violet-600/[0.10] blur-[120px]" />
        </div>
        <div className="relative">
          <div className="mb-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{paper.title}</p>
                <p className="text-xs text-slate-500">{format(tt.taking.questionOf, step + 1, total)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${lowTime ? 'animate-pulse bg-red-500/15 text-red-300 motion-reduce:animate-none' : 'bg-cyan-300/10 text-cyan-200'}`}>
                  <Clock className="h-4 w-4" /> {timeLeft !== null ? formatClock(timeLeft) : formatClock(secondsElapsed)}
                </span>
                <button onClick={onSubmit} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(244,63,94,.35)] transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200">
                  {tt.taking.submit}
                </button>
              </div>
            </div>
            {timeFraction !== null && (
              <div className="h-0.5 bg-white/[0.06]">
                <div className={`h-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none ${lowTime ? 'bg-red-400' : 'bg-cyan-300'}`} style={{ width: `${timeFraction * 100}%` }} />
              </div>
            )}
            <div className="grid grid-cols-4 divide-x divide-white/[0.07] border-t border-white/[0.07] text-center">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-0 px-2 py-2">
                  <p className="truncate text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</p>
                  <p className={`text-base font-semibold tabular-nums ${stat.tone}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[250px_1fr]">
            <div className="order-2 h-fit rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 lg:order-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{tt.taking.palette}</p>
              <div className="grid grid-cols-5 gap-2">
                {paper.questions.map((q, i) => {
                  const status = statuses[i];
                  return (
                    <button
                      key={q.id}
                      onClick={() => onGoToStep(i)}
                      type="button"
                      aria-label={format(tt.taking.paletteAria, i + 1, statusLabel[status])}
                      aria-current={i === step ? 'step' : undefined}
                      className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                        i === step ? 'border-white bg-white text-slate-900 shadow-[0_0_14px_rgba(255,255,255,.5)]' : statusTone[status]
                      }`}
                    >
                      {i + 1}
                      {status === 'answered-marked' && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[#080d19] bg-emerald-400" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-slate-500">{format(tt.taking.answeredCount, answeredCount, total)}</p>
            </div>

            <div className="order-1 lg:order-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 md:p-7"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-violet-200">
                      {currentQuestion.type === 'mcq' ? tt.taking.multipleChoice : tt.taking.shortAnswer}
                    </span>
                    <span className="text-xs text-slate-500">
                      {currentQuestion.type === 'mcq'
                        ? format(tt.taking.marksNegative, currentQuestion.marks, (currentQuestion as MCQQuestion).negativeMarks)
                        : format(tt.taking.marksPlain, currentQuestion.marks)}
                    </span>
                  </div>
                  <h2 className="mb-6 text-lg font-semibold leading-snug text-white md:text-xl">{currentQuestion.question}</h2>

                  {currentQuestion.type === 'mcq' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {(currentQuestion as MCQQuestion).options.map((opt, i) => {
                        const selected = currentAnswer && currentAnswer.type === 'mcq' && currentAnswer.selectedIndex === i;
                        return (
                          <button
                            key={i}
                            onClick={() => onSelectMCQ(i)}
                            type="button"
                            aria-pressed={!!selected}
                            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                              selected
                                ? 'border-cyan-300/70 bg-cyan-300/[0.12] shadow-[0_0_22px_rgba(103,232,249,.2)]'
                                : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]'
                            }`}
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? 'bg-cyan-300 text-slate-900' : 'bg-white/10 text-slate-300'}`}>{String.fromCharCode(65 + i)}</span>
                            <span className="pt-0.5 text-sm text-slate-100">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={currentAnswer && currentAnswer.type === 'subjective' ? currentAnswer.text : ''}
                      onChange={(e) => onSubjectiveText(e.target.value)}
                      placeholder={tt.taking.answerPlaceholder}
                      rows={6}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={() => onGoToStep(step - 1)} disabled={step === 0} className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                  <ChevronLeft className="h-4 w-4" /> {tt.taking.previous}
                </button>
                <button onClick={onClearResponse} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                  {tt.taking.clear}
                </button>
                <button onClick={onMarkForReview} className="flex items-center gap-1.5 rounded-xl border border-violet-400/40 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
                  <Flag className="h-4 w-4" /> {tt.taking.markNext}
                </button>
                <button onClick={onSaveAndNext} disabled={isLast} className="ml-auto rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_0_18px_rgba(103,232,249,.3)] transition hover:bg-cyan-200 disabled:opacity-30 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  {tt.taking.saveNext}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Results screen — score, self-grade subjective answers, PDF export
// ============================================================
function ResultsDashboard({
  attempt,
  allAttempts,
  onSaveInsight,
  onSelfGrade,
  onRetake,
}: {
  attempt: TestAttempt;
  allAttempts: TestAttempt[];
  onSaveInsight: (text: string) => void;
  onSelfGrade: (questionId: string, isCorrect: boolean, marks: number) => void;
  onRetake: () => void;
}) {
  const tt = useTranslation().testScreen;
  const resultsById = new Map(attempt.results.map((r) => [r.questionId, r]));
  const answersById = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const correctCount = attempt.results.filter((r) => r.isCorrect === true).length;
  const pending = pendingSelfGradeCount(attempt.results);
  const ringColor = attempt.scorePercent >= 80 ? '#34d399' : attempt.scorePercent >= 50 ? '#fbbf24' : '#f87171';

  return (
    <div className="mx-auto max-w-3xl">
      <GlassPanel accent={ringColor} className="mb-8">
        <div className="flex flex-col items-center gap-5 p-6 text-center md:flex-row md:p-8 md:text-left">
          <ProgressRing value={attempt.scorePercent} size={132} stroke={10} color={ringColor}>
            <span className="text-2xl font-semibold tabular-nums text-white">{attempt.obtainedMarks}/{attempt.totalMarks}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-sm text-slate-400">{attempt.testTitle}</p>
            <p className="text-2xl font-semibold text-white">{format(tt.results.summary, attempt.scorePercent, correctCount)}</p>
            {pending > 0 && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-amber-300 md:justify-start">
                <HelpCircle className="h-4 w-4" /> {format(pending === 1 ? tt.results.pendingOne : tt.results.pendingMany, pending)}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
              <button onClick={() => downloadTestResultPdf(attempt)} className="flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_0_18px_rgba(103,232,249,.3)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Download className="h-4 w-4" /> {tt.results.downloadPdf}
              </button>
              <button onClick={onRetake} className="flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <RotateCcw className="h-4 w-4" /> {tt.results.backToTests}
              </button>
            </div>
          </div>
        </div>
      </GlassPanel>

      <TestAnalysis attempt={attempt} allAttempts={allAttempts} onSaveInsight={onSaveInsight} />

      <div className="space-y-4">
        {attempt.questions.map((q, i) => {
          const result = resultsById.get(q.id);
          const answer = answersById.get(q.id);
          const isCorrect = result?.isCorrect;
          const borderClass =
            isCorrect === true
              ? 'border-emerald-400/25 bg-emerald-400/[0.05]'
              : isCorrect === false
                ? 'border-red-400/25 bg-red-400/[0.05]'
                : 'border-amber-400/25 bg-amber-400/[0.05]';

          return (
            <div key={q.id} className={`rounded-2xl border p-5 ${borderClass}`}>
              <div className="mb-3 flex items-start gap-3">
                {isCorrect === true ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                ) : isCorrect === false ? (
                  <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                ) : (
                  <HelpCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                )}
                <p className="flex-1 font-medium text-white">{format(tt.results.questionPrefix, i + 1)} {q.question}</p>
                <span className="flex-shrink-0 text-xs tabular-nums text-slate-500">{result?.marksObtained ?? 0}/{q.marks}</span>
              </div>

              {q.type === 'mcq' ? (
                <div className="mb-3 ml-8 space-y-1.5">
                  {(q as MCQQuestion).options.map((opt, oi) => {
                    const selected = answer && answer.type === 'mcq' && answer.selectedIndex === oi;
                    const correct = oi === (q as MCQQuestion).correctIndex;
                    return (
                      <p key={oi} className={`text-sm ${correct ? 'font-medium text-emerald-300' : selected ? 'font-medium text-red-300' : 'text-slate-400'}`}>
                        {String.fromCharCode(65 + oi)}. {opt}
                        {correct ? ` ${tt.results.correctTag}` : selected ? ` ${tt.results.yourAnswerTag}` : ''}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="mb-3 ml-8 space-y-2 text-sm">
                  <p className="text-slate-300">
                    <span className="font-medium">{tt.results.yourAnswer}</span>
                    {answer && answer.type === 'subjective' && answer.text.trim() ? answer.text.trim() : <em>{tt.results.leftBlank}</em>}
                  </p>
                  {(q as SubjectiveQuestion).modelAnswer && (
                    <p className="text-emerald-300">
                      <span className="font-medium">{tt.results.modelAnswer}</span>
                      {(q as SubjectiveQuestion).modelAnswer}
                    </p>
                  )}
                  {isCorrect === null && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => onSelfGrade(q.id, true, q.marks)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                        {tt.results.gotRight}
                      </button>
                      <button onClick={() => onSelfGrade(q.id, false, q.marks)} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200">
                        {tt.results.gotWrong}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {q.explanation && (
                <p className="ml-8 text-sm text-slate-400">
                  <span className="font-medium text-slate-200">{tt.results.why}</span>
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
