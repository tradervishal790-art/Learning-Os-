import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RotateCcw, CheckCircle2, XCircle, HelpCircle, History, Plus, Pencil, Trash2, Clock, Flag, Sparkles } from 'lucide-react';
import type { TestPaper, TestQuestion, TestUserAnswer, TestAttempt, MCQQuestion, SubjectiveQuestion } from './types';
import { getTestPapers, saveTestPaper, deleteTestPaper } from './testBankStore';
import { OFFICIAL_TESTS } from './officialTests';
import { getTestAttempts, saveTestAttempt, updateTestAttempt } from './testStore';
import { buildInitialResults, selfGradeSubjective, applyAIGradeBatch, computeTotalMarks, computeObtainedMarks, computeScorePercent, pendingSelfGradeCount, isAnswered } from './testGrading';
import { checkAnswersWithAI } from './testAI';
import { downloadTestResultPdf } from './testPdf';
import TestBuilder from './TestBuilder';

// ============================================================
// Test.tsx — "Test" tab (Dashboard renders <Test /> with no props).
// Every question is authored by hand in TestBuilder.tsx and stored in
// testBankStore.ts — AI is opt-in only, never automatic: TestBuilder can
// ask Gemini to fill in a missing answer key (testAI.ts), and the results
// screen below can ask Gemini to check a subjective answer instead of
// self-marking it. Flow:
//   list         → pick a saved test paper, or create/edit/delete one
//   instructions → duration, marking scheme, palette legend, Start
//   taking       → NTA/JEE-Main-style exam UI: timer, question palette,
//                  Save & Next / Mark for Review / Clear Response
//   results      → score, self-grade (or AI-check) subjective answers, PDF export
// ============================================================

type Stage = 'list' | 'builder' | 'instructions' | 'taking' | 'results';
type QuestionStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function Test() {
  const [stage, setStage] = useState<Stage>('list');
  const [papers, setPapers] = useState<TestPaper[]>([]);
  const [history, setHistory] = useState<TestAttempt[]>([]);
  const [editingPaper, setEditingPaper] = useState<TestPaper | null>(null);
  const [activePaper, setActivePaper] = useState<TestPaper | null>(null);

  // ── taking-stage state ──────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<TestUserAnswer[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, QuestionStatus>>({});
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);

  // Refs mirror the latest state so submitTest (called from the timer
  // effect, which only re-subscribes when `stage`/`timeLeft` change) always
  // reads the current paper/answers/elapsed time instead of a stale closure.
  const activePaperRef = useRef(activePaper);
  const answersRef = useRef(answers);
  const secondsElapsedRef = useRef(secondsElapsed);
  useEffect(() => {
    activePaperRef.current = activePaper;
  }, [activePaper]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    secondsElapsedRef.current = secondsElapsed;
  }, [secondsElapsed]);

  const refresh = useCallback(() => {
    setPapers(getTestPapers());
    setHistory(getTestAttempts());
  }, []);

  useEffect(() => {
    refresh();
  }, [stage, refresh]);

  // ── timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'taking') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

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
    if (!confirm('Delete this test? This cannot be undone.')) return;
    deleteTestPaper(id);
    refresh();
  };

  // ── taking a test ────────────────────────────────────────────────────
  const startInstructions = (p: TestPaper) => {
    setActivePaper(p);
    setStage('instructions');
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
    const results = buildInitialResults(paper.questions, currentAnswers);
    const totalMarks = computeTotalMarks(paper.questions);
    const obtainedMarks = computeObtainedMarks(results);
    const newAttempt: TestAttempt = {
      id: `attempt_${Date.now()}`,
      testId: paper.id,
      testTitle: paper.title,
      topic: paper.topic,
      completedAt: new Date().toISOString(),
      timeTakenSeconds: secondsElapsedRef.current,
      questions: paper.questions,
      answers: currentAnswers,
      results,
      totalMarks,
      obtainedMarks,
      scorePercent: computeScorePercent(obtainedMarks, totalMarks),
    };
    saveTestAttempt(newAttempt);
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
    const msg = unanswered > 0 ? `${unanswered} question(s) unanswered. Submit anyway?` : 'Submit the test now?';
    if (confirm(msg)) submitTest();
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
    setAttempt(updated);
  };

  /** One batched AI-check call (checkAnswersWithAI) comes back with several
   *  verdicts at once — fold them all into the attempt in a single update
   *  (applyAIGradeBatch) rather than calling handleSelfGrade in a loop,
   *  which would have each iteration overwrite the last from a stale
   *  `attempt` snapshot. */
  const handleAIGradeBatch = (graded: { id: string; isCorrect: boolean; feedback: string }[]) => {
    if (!attempt) return;
    const results = applyAIGradeBatch(attempt.results, attempt.questions, graded);
    const obtainedMarks = computeObtainedMarks(results);
    const updated: TestAttempt = { ...attempt, results, obtainedMarks, scorePercent: computeScorePercent(obtainedMarks, attempt.totalMarks) };
    updateTestAttempt(updated);
    setAttempt(updated);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 md:p-8">
      {stage !== 'taking' && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Tests</h1>
          <p className="text-gray-500 dark:text-white/60">Take official tests, or build your own for practice.</p>
        </motion.div>
      )}

      {stage === 'list' && (
        <TestList
          papers={papers}
          history={history}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={handleDeletePaper}
          onTake={startInstructions}
          onOpenAttempt={openPastAttempt}
        />
      )}

      {stage === 'builder' && <TestBuilder initialPaper={editingPaper} onSave={handleSavePaper} onCancel={() => setStage('list')} />}

      {stage === 'instructions' && activePaper && <Instructions paper={activePaper} onStart={beginTest} onBack={() => setStage('list')} />}

      {stage === 'taking' && activePaper && currentQuestion && (
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
      )}

      {stage === 'results' && attempt && (
        <ResultsDashboard attempt={attempt} onSelfGrade={handleSelfGrade} onAIGradeBatch={handleAIGradeBatch} onRetake={startOver} />
      )}
    </div>
  );
}

// ============================================================
// List screen: saved test papers + past attempt history
// ============================================================
function TestList({
  papers,
  history,
  onCreate,
  onEdit,
  onDelete,
  onTake,
  onOpenAttempt,
}: {
  papers: TestPaper[];
  history: TestAttempt[];
  onCreate: () => void;
  onEdit: (p: TestPaper) => void;
  onDelete: (id: string) => void;
  onTake: (p: TestPaper) => void;
  onOpenAttempt: (a: TestAttempt) => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      {OFFICIAL_TESTS.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-white/50 mb-3">Official tests</h2>
          <div className="space-y-3">
            {OFFICIAL_TESTS.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 dark:text-white/40">
                    {p.topic} · {p.questions.length} questions
                    {p.durationMinutes > 0 ? ` · ${p.durationMinutes} min` : ' · no timer'}
                  </p>
                </div>
                <button onClick={() => onTake(p)} className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-semibold transition flex-shrink-0">
                  Take Test
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-500 dark:text-white/50 mb-3">My tests</h2>
      <button
        onClick={onCreate}
        className="w-full flex items-center justify-center gap-2 py-3.5 mb-8 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold transition"
      >
        <Plus className="w-4 h-4" /> Create New Test
      </button>

      {papers.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-white/40 mb-10">You haven't created any tests yet — add your own questions above.</p>
      ) : (
        <div className="space-y-3 mb-10">
          {papers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{p.title}</p>
                <p className="text-xs text-gray-400 dark:text-white/40">
                  {p.topic} · {p.questions.length} question{p.questions.length !== 1 ? 's' : ''}
                  {p.durationMinutes > 0 ? ` · ${p.durationMinutes} min` : ' · no timer'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => onEdit(p)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Edit test">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(p.id)} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/10 text-red-500" aria-label="Delete test">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => onTake(p)} className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-semibold transition">
                  Take Test
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-white/50 mb-3">
            <History className="w-4 h-4" /> Past attempts
          </h2>
          <div className="space-y-2">
            {history.slice(0, 8).map((a) => (
              <button
                key={a.id}
                onClick={() => onOpenAttempt(a)}
                className="w-full flex items-center justify-between text-left px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                <div>
                  <p className="font-medium">{a.testTitle}</p>
                  <p className="text-xs text-gray-400 dark:text-white/40">{new Date(a.completedAt).toLocaleString()}</p>
                </div>
                <span className={`text-sm font-bold ${a.scorePercent >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
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
  const totalMarks = computeTotalMarks(paper.questions);
  const mcqCount = paper.questions.filter((q) => q.type === 'mcq').length;
  const subjCount = paper.questions.length - mcqCount;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-1">{paper.title}</h2>
        <p className="text-gray-500 dark:text-white/60 mb-6">{paper.topic}</p>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
            <p className="text-gray-400 dark:text-white/40">Duration</p>
            <p className="font-semibold text-lg">{paper.durationMinutes > 0 ? `${paper.durationMinutes} min` : 'No limit'}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
            <p className="text-gray-400 dark:text-white/40">Total marks</p>
            <p className="font-semibold text-lg">{totalMarks}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
            <p className="text-gray-400 dark:text-white/40">MCQ questions</p>
            <p className="font-semibold text-lg">{mcqCount}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
            <p className="text-gray-400 dark:text-white/40">Subjective questions</p>
            <p className="font-semibold text-lg">{subjCount}</p>
          </div>
        </div>

        <h3 className="font-semibold mb-3 text-sm text-gray-600 dark:text-white/70">Question palette legend</h3>
        <div className="space-y-2 mb-8 text-sm">
          <LegendRow color="bg-gray-300 dark:bg-white/20" label="Not visited yet" />
          <LegendRow color="bg-orange-400" label="Visited, not answered" />
          <LegendRow color="bg-emerald-500" label="Answered" />
          <LegendRow color="bg-purple-500" label="Marked for review (not scored)" />
          <LegendRow color="bg-purple-500" label="Answered & marked for review (scored)" dot />
        </div>

        <div className="flex gap-3">
          <button onClick={onStart} className="flex-1 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold transition">
            Start Test
          </button>
          <button onClick={onBack} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 font-medium transition">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`relative w-5 h-5 rounded ${color} flex-shrink-0`}>
        {dot && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white dark:border-black" />}
      </span>
      <span className="text-gray-600 dark:text-white/70">{label}</span>
    </div>
  );
}

// ============================================================
// Taking screen — timer, single question, palette, nav buttons
// ============================================================
function TakingScreen({
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
  const statusColor: Record<QuestionStatus, string> = {
    'not-visited': 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-white/50',
    'not-answered': 'bg-orange-400 text-white',
    answered: 'bg-emerald-500 text-white',
    marked: 'bg-purple-500 text-white',
    'answered-marked': 'bg-purple-500 text-white',
  };

  const isLast = step === paper.questions.length - 1;
  const lowTime = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="font-semibold">{paper.title}</p>
          <p className="text-xs text-gray-400 dark:text-white/40">Question {step + 1} of {paper.questions.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-semibold ${lowTime ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-white/10'}`}>
            <Clock className="w-4 h-4" /> {timeLeft !== null ? formatClock(timeLeft) : formatClock(secondsElapsed)}
          </span>
          <button onClick={onSubmit} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold transition">
            Submit Test
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium tracking-wide uppercase text-purple-500 dark:text-purple-300/70 bg-purple-100 dark:bg-purple-500/10 border border-purple-300/40 dark:border-purple-500/20 rounded-full px-3 py-1">
                  {currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
                </span>
                <span className="text-xs text-gray-400 dark:text-white/40">
                  +{currentQuestion.marks}{currentQuestion.type === 'mcq' ? ` / -${(currentQuestion as MCQQuestion).negativeMarks}` : ''} marks
                </span>
              </div>
              <h2 className="text-xl font-semibold mb-6 leading-snug">{currentQuestion.question}</h2>

              {currentQuestion.type === 'mcq' ? (
                <div className="space-y-3">
                  {(currentQuestion as MCQQuestion).options.map((opt, i) => {
                    const selected = currentAnswer && currentAnswer.type === 'mcq' && currentAnswer.selectedIndex === i;
                    return (
                      <button
                        key={i}
                        onClick={() => onSelectMCQ(i)}
                        className={`w-full text-left p-4 rounded-xl border transition ${
                          selected
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                            : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                      >
                        <span className="text-sm">{String.fromCharCode(65 + i)}. {opt}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={currentAnswer && currentAnswer.type === 'subjective' ? currentAnswer.text : ''}
                  onChange={(e) => onSubjectiveText(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-black dark:focus:border-white resize-none"
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center flex-wrap gap-3 mt-6">
            <button onClick={onClearResponse} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-medium transition">
              Clear Response
            </button>
            <button onClick={onMarkForReview} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10 text-sm font-medium transition">
              <Flag className="w-4 h-4" /> Mark for Review & Next
            </button>
            <button onClick={onSaveAndNext} disabled={isLast} className="ml-auto px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-30 text-sm font-semibold transition">
              Save & Next
            </button>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 h-fit">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40 mb-3">Question Palette</p>
          <div className="grid grid-cols-5 gap-2">
            {paper.questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => onGoToStep(i)}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${statusColor[statusMap[q.id] ?? 'not-visited']} ${i === step ? 'ring-2 ring-offset-2 ring-black dark:ring-white dark:ring-offset-black' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-white/40 mt-4">
            {answers.filter((a) => isAnswered(a)).length}/{paper.questions.length} answered
          </p>
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
  onSelfGrade,
  onAIGradeBatch,
  onRetake,
}: {
  attempt: TestAttempt;
  onSelfGrade: (questionId: string, isCorrect: boolean, marks: number) => void;
  onAIGradeBatch: (graded: { id: string; isCorrect: boolean; feedback: string }[]) => void;
  onRetake: () => void;
}) {
  const [aiChecking, setAiChecking] = useState(false);
  const [aiError, setAiError] = useState('');

  const resultsById = new Map(attempt.results.map((r) => [r.questionId, r]));
  const answersById = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const correctCount = attempt.results.filter((r) => r.isCorrect === true).length;
  const pending = pendingSelfGradeCount(attempt.results);

  // Pending subjective questions that were actually answered — AI has
  // nothing to check on a blank one, so those stay for manual self-grade only.
  const aiCheckableIds = new Set(
    attempt.questions
      .filter((q) => q.type === 'subjective' && resultsById.get(q.id)?.isCorrect === null)
      .filter((q) => {
        const a = answersById.get(q.id);
        return a && a.type === 'subjective' && a.text.trim().length > 0;
      })
      .map((q) => q.id)
  );

  const handleCheckAllWithAI = async () => {
    const items = attempt.questions
      .filter((q): q is SubjectiveQuestion => q.type === 'subjective' && aiCheckableIds.has(q.id))
      .map((q) => {
        const a = answersById.get(q.id);
        const userAnswer = a && a.type === 'subjective' ? a.text.trim() : '';
        return { id: q.id, question: q.question, modelAnswer: q.modelAnswer, userAnswer, marks: q.marks };
      });
    if (items.length === 0) return;
    setAiChecking(true);
    setAiError('');
    try {
      const results = await checkAnswersWithAI(items);
      onAIGradeBatch(results);
    } catch (e: any) {
      setAiError(e?.message || 'AI check failed — you can still self-grade below.');
    } finally {
      setAiChecking(false);
    }
  };

  const scoreColor = attempt.scorePercent >= 80 ? 'text-emerald-500' : attempt.scorePercent >= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8 mb-8 text-center">
        <p className="text-sm text-gray-500 dark:text-white/50 mb-1">{attempt.testTitle}</p>
        <p className={`text-5xl font-bold mb-2 ${scoreColor}`}>{attempt.obtainedMarks}/{attempt.totalMarks}</p>
        <p className="text-gray-500 dark:text-white/60 mb-1">{attempt.scorePercent}% · {correctCount} correct</p>
        {pending > 0 && (
          <div className="mb-4">
            <p className="flex items-center justify-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 mb-2">
              <HelpCircle className="w-4 h-4" /> {pending} subjective answer{pending !== 1 ? 's' : ''} awaiting grading
            </p>
            {aiCheckableIds.size > 0 && (
              <button
                onClick={handleCheckAllWithAI}
                disabled={aiChecking}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-semibold transition disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiChecking ? 'AI is checking…' : `Check ${aiCheckableIds.size} with AI`}
              </button>
            )}
            {aiError && <p className="text-red-500 text-xs mt-2">{aiError}</p>}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <button onClick={() => downloadTestResultPdf(attempt)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold transition">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button onClick={onRetake} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-semibold transition">
            <RotateCcw className="w-4 h-4" /> Back to Tests
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {attempt.questions.map((q, i) => {
          const result = resultsById.get(q.id);
          const answer = answersById.get(q.id);
          const isCorrect = result?.isCorrect;
          const borderClass =
            isCorrect === true
              ? 'border-emerald-300/40 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/5'
              : isCorrect === false
                ? 'border-red-300/40 dark:border-red-500/20 bg-red-50/40 dark:bg-red-500/5'
                : 'border-amber-300/40 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/5';

          return (
            <div key={q.id} className={`rounded-2xl border p-5 ${borderClass}`}>
              <div className="flex items-start gap-3 mb-3">
                {isCorrect === true ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : isCorrect === false ? (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <HelpCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <p className="font-medium flex-1">Q{i + 1}. {q.question}</p>
                <span className="text-xs text-gray-400 dark:text-white/40 flex-shrink-0">{result?.marksObtained ?? 0}/{q.marks}</span>
              </div>

              {q.type === 'mcq' ? (
                <div className="ml-8 space-y-1.5 mb-3">
                  {(q as MCQQuestion).options.map((opt, oi) => {
                    const selected = answer && answer.type === 'mcq' && answer.selectedIndex === oi;
                    const correct = oi === (q as MCQQuestion).correctIndex;
                    return (
                      <p key={oi} className={`text-sm ${correct ? 'text-emerald-600 dark:text-emerald-400 font-medium' : selected ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-white/50'}`}>
                        {String.fromCharCode(65 + oi)}. {opt}
                        {correct ? ' (correct)' : selected ? ' (your answer)' : ''}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="ml-8 mb-3 space-y-2 text-sm">
                  <p className="text-gray-600 dark:text-white/70">
                    <span className="font-medium">Your answer: </span>
                    {answer && answer.type === 'subjective' && answer.text.trim() ? answer.text.trim() : <em>left blank</em>}
                  </p>
                  {(q as SubjectiveQuestion).modelAnswer && (
                    <p className="text-emerald-600 dark:text-emerald-400">
                      <span className="font-medium">Model answer: </span>
                      {(q as SubjectiveQuestion).modelAnswer}
                    </p>
                  )}
                  {result?.feedback && (
                    <p className="text-sky-600 dark:text-sky-400 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span><span className="font-medium">AI: </span>{result.feedback}</span>
                    </p>
                  )}
                  {isCorrect === null && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => onSelfGrade(q.id, true, q.marks)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold transition">
                        I got this right
                      </button>
                      <button onClick={() => onSelfGrade(q.id, false, q.marks)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold transition">
                        I got this wrong
                      </button>
                    </div>
                  )}
                </div>
              )}

              {q.explanation && (
                <p className="ml-8 text-sm text-gray-500 dark:text-white/60">
                  <span className="font-medium text-gray-700 dark:text-white/80">Why: </span>
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
