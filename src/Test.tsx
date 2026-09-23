import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RotateCcw, CheckCircle2, XCircle, History, ArrowLeft, ArrowRight } from 'lucide-react';
import type { TestData, TestQuestion, TestUserAnswer, GradedResult, TestAttempt, MCQQuestion, SubjectiveQuestion } from './types';
import { buildSubjectiveGradingItems, buildFinalResults, computeScorePercent } from './testGrading';
import { getTestAttempts, saveTestAttempt } from './testStore';
import { downloadTestResultPdf } from './testPdf';

// ============================================================
// Test.tsx — standalone "Test" tab (Dashboard renders <Test /> with no
// props, same as Notes.tsx). Flow:
//   setup   → learner types a topic + picks question counts
//   taking  → step through questions one at a time (MCQ radio / textarea)
//   grading → subjective answers sent to api/grade-test.ts (MCQs are
//             already graded instantly, client-side, in testGrading.ts)
//   results → score dashboard, mistake/explanation breakdown, PDF download
// A short history list (testStore.ts) lets the learner re-open or
// re-download a past attempt without retaking it.
// ============================================================

type Stage = 'setup' | 'taking' | 'grading' | 'results';

async function generateTest(topic: string, mcqCount: number, subjectiveCount: number): Promise<TestData> {
  const response = await fetch('/api/generate-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, mcqCount, subjectiveCount }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Test generation failed (${response.status})`);
  return data as TestData;
}

async function gradeSubjectiveAnswers(
  topic: string,
  items: { questionId: string; question: string; modelAnswer: string; userAnswer: string }[]
): Promise<GradedResult[]> {
  if (items.length === 0) return [];
  const response = await fetch('/api/grade-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, items }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Grading failed (${response.status})`);
  return (data.results ?? []) as GradedResult[];
}

export default function Test() {
  const [stage, setStage] = useState<Stage>('setup');
  const [topic, setTopic] = useState('');
  const [mcqCount, setMcqCount] = useState(5);
  const [subjectiveCount, setSubjectiveCount] = useState(3);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<TestUserAnswer[]>([]);

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [history, setHistory] = useState<TestAttempt[]>([]);

  useEffect(() => {
    setHistory(getTestAttempts());
  }, [stage]);

  const currentQuestion = questions[step];
  const currentAnswer = currentQuestion ? answers.find((a) => a.questionId === currentQuestion.id) : undefined;

  const startTest = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await generateTest(topic.trim(), mcqCount, subjectiveCount);
      setQuestions(data.questions);
      setAnswers(
        data.questions.map((q) =>
          q.type === 'mcq' ? { questionId: q.id, type: 'mcq', selectedIndex: null } : { questionId: q.id, type: 'subjective', text: '' }
        )
      );
      setStep(0);
      setStage('taking');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test.');
    } finally {
      setLoading(false);
    }
  };

  const selectMCQ = (index: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => prev.map((a) => (a.questionId === currentQuestion.id ? { ...a, type: 'mcq', selectedIndex: index } : a)));
  };

  const setSubjectiveText = (text: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => prev.map((a) => (a.questionId === currentQuestion.id ? { ...a, type: 'subjective', text } : a)));
  };

  const submitTest = async () => {
    setStage('grading');
    setError('');
    try {
      const items = buildSubjectiveGradingItems(questions, answers);
      const subjectiveResults = await gradeSubjectiveAnswers(topic, items);
      const results = buildFinalResults(questions, answers, subjectiveResults);
      const scorePercent = computeScorePercent(results);
      const newAttempt: TestAttempt = {
        id: `attempt_${Date.now()}`,
        topic: topic.trim(),
        completedAt: new Date().toISOString(),
        questions,
        answers,
        results,
        scorePercent,
      };
      saveTestAttempt(newAttempt);
      setAttempt(newAttempt);
      setStage('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed — your MCQ answers are still saved, try submitting again.');
      setStage('taking');
      setStep(questions.length - 1);
    }
  };

  const startOver = () => {
    setStage('setup');
    setQuestions([]);
    setAnswers([]);
    setAttempt(null);
    setStep(0);
    setError('');
  };

  const openPastAttempt = (a: TestAttempt) => {
    setAttempt(a);
    setQuestions(a.questions);
    setAnswers(a.answers);
    setTopic(a.topic);
    setStage('results');
  };

  const answeredCount = answers.filter((a) => (a.type === 'mcq' ? a.selectedIndex !== null : a.text.trim().length > 0)).length;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Test Yourself</h1>
        <p className="text-gray-500 dark:text-white/60">Generate a quick test on any topic, then get a full results breakdown.</p>
      </motion.div>

      {stage === 'setup' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8 mb-8">
            <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-white/70">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startTest()}
              placeholder="e.g. Photosynthesis, React Hooks, Newton's Laws..."
              className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white mb-5"
            />

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-white/70">MCQ questions</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={mcqCount}
                  onChange={(e) => setMcqCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-white/70">Subjective questions</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={subjectiveCount}
                  onChange={(e) => setSubjectiveCount(Math.min(6, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>
            </div>

            <button
              onClick={startTest}
              disabled={loading || !topic.trim()}
              className="w-full py-3 bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 rounded-xl font-semibold transition"
            >
              {loading ? 'Generating test...' : 'Generate Test'}
            </button>
            {error && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-3">{error}</p>}
          </div>

          {history.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-white/50 mb-3">
                <History className="w-4 h-4" /> Past attempts
              </h2>
              <div className="space-y-2">
                {history.slice(0, 8).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => openPastAttempt(a)}
                    className="w-full flex items-center justify-between text-left px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    <div>
                      <p className="font-medium">{a.topic}</p>
                      <p className="text-xs text-gray-400 dark:text-white/40">{new Date(a.completedAt).toLocaleString()}</p>
                    </div>
                    <span className={`text-sm font-bold ${a.scorePercent >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {a.scorePercent}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'taking' && currentQuestion && (
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-400 dark:text-white/50 mb-2">
              <span>{topic}</span>
              <span>{step + 1} / {questions.length}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 via-blue-400 to-pink-500 rounded-full"
                animate={{ width: `${((step + 1) / questions.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8"
            >
              <span className="inline-block mb-3 text-xs font-medium tracking-wide uppercase text-purple-500 dark:text-purple-300/70 bg-purple-100 dark:bg-purple-500/10 border border-purple-300/40 dark:border-purple-500/20 rounded-full px-3 py-1">
                {currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
              </span>
              <h2 className="text-xl font-semibold mb-6 leading-snug">{currentQuestion.question}</h2>

              {currentQuestion.type === 'mcq' ? (
                <div className="space-y-3">
                  {(currentQuestion as MCQQuestion).options.map((opt, i) => {
                    const selected = currentAnswer && currentAnswer.type === 'mcq' && currentAnswer.selectedIndex === i;
                    return (
                      <button
                        key={i}
                        onClick={() => selectMCQ(i)}
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
                  onChange={(e) => setSubjectiveText(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white resize-none"
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/10 transition text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <span className="text-xs text-gray-400 dark:text-white/40">{answeredCount}/{questions.length} answered</span>
            {step < questions.length - 1 ? (
              <button
                onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={submitTest}
                className="px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-semibold"
              >
                Submit Test
              </button>
            )}
          </div>
          {error && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-3 text-center">{error}</p>}
        </div>
      )}

      {stage === 'grading' && (
        <div className="max-w-2xl mx-auto text-center py-24">
          <div className="inline-flex gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" />
            <span className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-gray-500 dark:text-white/60">Grading your answers...</p>
        </div>
      )}

      {stage === 'results' && attempt && (
        <ResultsDashboard attempt={attempt} onRetake={startOver} />
      )}
    </div>
  );
}

function ResultsDashboard({ attempt, onRetake }: { attempt: TestAttempt; onRetake: () => void }) {
  const resultsById = new Map(attempt.results.map((r) => [r.questionId, r]));
  const answersById = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const correctCount = attempt.results.filter((r) => r.isCorrect).length;
  const mistakes = attempt.questions.filter((q) => !resultsById.get(q.id)?.isCorrect);

  const scoreColor = attempt.scorePercent >= 80 ? 'text-emerald-500' : attempt.scorePercent >= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8 mb-8 text-center">
        <p className="text-sm text-gray-500 dark:text-white/50 mb-1">{attempt.topic}</p>
        <p className={`text-5xl font-bold mb-2 ${scoreColor}`}>{attempt.scorePercent}%</p>
        <p className="text-gray-500 dark:text-white/60 mb-6">
          {correctCount} of {attempt.results.length} correct — {mistakes.length} to review
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => downloadTestResultPdf(attempt)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold transition"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button
            onClick={onRetake}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-semibold transition"
          >
            <RotateCcw className="w-4 h-4" /> Take Another Test
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {attempt.questions.map((q, i) => {
          const result = resultsById.get(q.id);
          const answer = answersById.get(q.id);
          const isCorrect = !!result?.isCorrect;
          return (
            <div
              key={q.id}
              className={`rounded-2xl border p-5 ${
                isCorrect
                  ? 'border-emerald-300/40 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/5'
                  : 'border-red-300/40 dark:border-red-500/20 bg-red-50/40 dark:bg-red-500/5'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                {isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <p className="font-medium">Q{i + 1}. {q.question}</p>
              </div>

              {q.type === 'mcq' ? (
                <div className="ml-8 space-y-1.5 mb-3">
                  {(q as MCQQuestion).options.map((opt, oi) => {
                    const selected = answer && answer.type === 'mcq' && answer.selectedIndex === oi;
                    const correct = oi === (q as MCQQuestion).correctIndex;
                    return (
                      <p
                        key={oi}
                        className={`text-sm ${
                          correct
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : selected
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : 'text-gray-500 dark:text-white/50'
                        }`}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                        {correct ? ' (correct)' : selected ? ' (your answer)' : ''}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="ml-8 mb-3 space-y-1.5 text-sm">
                  <p className="text-gray-600 dark:text-white/70">
                    <span className="font-medium">Your answer: </span>
                    {answer && answer.type === 'subjective' && answer.text.trim() ? answer.text.trim() : <em>left blank</em>}
                  </p>
                  <p className="text-emerald-600 dark:text-emerald-400">
                    <span className="font-medium">Model answer: </span>
                    {(q as SubjectiveQuestion).modelAnswer}
                  </p>
                  {result?.feedback && <p className="text-gray-500 dark:text-white/50 italic">{result.feedback}</p>}
                </div>
              )}

              <p className="ml-8 text-sm text-gray-500 dark:text-white/60">
                <span className="font-medium text-gray-700 dark:text-white/80">Why: </span>
                {q.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}