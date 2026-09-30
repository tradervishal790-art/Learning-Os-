import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { TestPaper, TestUserAnswer } from './types';
import { isAnswered } from './testGrading';
import { TakingScreen, type QuestionStatus } from './Test';
import { JoinError, joinLiveSession, normalizeCode, normalizePhone, submitLiveAnswers, subscribeSession, type LiveSession } from './liveTest';
import { loadSavedTheme } from './ThemeContext';

// ============================================================
// LiveJoin.tsx — public page at /live/:code (outside the login gate).
// A participant types name + phone, waits for the host to press Start,
// then takes the same NTA-style test. Answers are sent once, at submit
// (or automatically when the timer ends). No answer key ever reaches
// this page — the host's device grades everyone.
// ============================================================

interface SavedPlayer {
  name: string;
  phone: string;
}
interface SavedDraft {
  answers: TestUserAnswer[];
  statusMap: Record<string, QuestionStatus>;
  step: number;
}

const playerKey = (code: string) => `learning_os_live_player_${code}`;
const doneKey = (code: string) => `learning_os_live_done_${code}`;
const draftKey = (code: string, phone: string) => `learning_os_live_draft_${code}_${phone}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // non-critical
  }
}

export default function LiveJoin() {
  const location = useLocation();
  const code = normalizeCode(location.pathname.split('/')[2] ?? '');

  const [session, setSession] = useState<LiveSession | null | 'loading'>('loading');
  const [player, setPlayer] = useState<SavedPlayer | null>(() => readJson<SavedPlayer>(playerKey(code)));
  const [joined, setJoined] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [name, setName] = useState(player?.name ?? '');
  const [phoneInput, setPhoneInput] = useState(player?.phone ?? '');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [submitted, setSubmitted] = useState(() => localStorage.getItem(doneKey(code)) === '1');
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'failed'>('idle');
  const [submitNote, setSubmitNote] = useState('');

  // ── test-taking state (same shape as Test.tsx) ──
  const [answers, setAnswers] = useState<TestUserAnswer[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, QuestionStatus>>({});
  const [step, setStep] = useState(0);
  const initialisedRef = useRef(false);
  const sendingRef = useRef(false);

  // theme (this page renders outside AuthGate/ThemeProvider)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', loadSavedTheme() === 'dark');
  }, []);

  useEffect(() => {
    if (!code) {
      setSession(null);
      return;
    }
    return subscribeSession(code, setSession);
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const join = useCallback(
    async (n: string, phone: string) => {
      setBusy(true);
      setFormError('');
      try {
        const res = await joinLiveSession(code, n, phone);
        setOffsetMs(res.offsetMs);
        const p = { name: res.name, phone };
        writeJson(playerKey(code), p);
        setPlayer(p);
        setJoined(true);
      } catch (e) {
        const reason = e instanceof JoinError ? e.reason : null;
        if (reason === 'ALREADY_DONE') {
          localStorage.setItem(doneKey(code), '1');
          setSubmitted(true);
          setSubmitNote('already-or-closed');
        } else if (reason === 'NOT_ALLOWED') {
          setFormError('This phone number is not on the list for this test. Please contact your host.');
        } else if (reason === 'OTHER_DEVICE') {
          setFormError('This number is already in use on another device. Ask your host to unlock it.');
        } else {
          setFormError('Could not join. Check your internet and try again.');
        }
      } finally {
        setBusy(false);
      }
    },
    [code]
  );

  // Refresh / reopen: silently re-join with the saved name + phone.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current || !player || session === 'loading' || session === null || submitted) return;
    autoJoinedRef.current = true;
    void join(player.name, player.phone);
  }, [player, session, submitted, join]);

  const handleJoin = () => {
    const n = name.trim();
    const phone = normalizePhone(phoneInput);
    if (n.length < 2) return setFormError('Please enter your full name.');
    if (!phone) return setFormError('Please enter a valid 10-digit phone number.');
    void join(n, phone);
  };

  const live = session !== 'loading' && session !== null ? session : null;

  const paper: TestPaper | null = useMemo(
    () =>
      live
        ? { id: live.code, title: live.title, topic: live.topic, durationMinutes: live.durationMinutes, questions: live.questions, createdAt: '', updatedAt: '' }
        : null,
    [live]
  );

  const isRunning = live?.status === 'running' && joined && !submitted;

  // Set up answers/palette once the test is running (restoring a saved draft after refresh).
  useEffect(() => {
    if (!isRunning || !paper || !player || initialisedRef.current) return;
    initialisedRef.current = true;
    const draft = readJson<SavedDraft>(draftKey(code, player.phone));
    if (draft && draft.answers.length === paper.questions.length) {
      setAnswers(draft.answers);
      setStatusMap(draft.statusMap);
      setStep(draft.step);
      return;
    }
    setAnswers(
      paper.questions.map((q) => (q.type === 'mcq' ? { questionId: q.id, type: 'mcq', selectedIndex: null } : { questionId: q.id, type: 'subjective', text: '' }))
    );
    const initial: Record<string, QuestionStatus> = {};
    paper.questions.forEach((q, i) => {
      initial[q.id] = i === 0 ? 'not-answered' : 'not-visited';
    });
    setStatusMap(initial);
    setStep(0);
  }, [isRunning, paper, player, code]);

  useEffect(() => {
    if (!isRunning || !player || answers.length === 0) return;
    writeJson(draftKey(code, player.phone), { answers, statusMap, step });
  }, [isRunning, player, code, answers, statusMap, step]);

  // Shared countdown: host's start time + this device's measured clock offset.
  const elapsed = live?.startedAtMs ? Math.max(0, Math.floor((now + offsetMs - live.startedAtMs) / 1000)) : 0;
  const durationSec = (live?.durationMinutes ?? 0) * 60;
  const timeLeft = durationSec > 0 ? durationSec - elapsed : null;

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  const doSubmit = useCallback(async () => {
    if (sendingRef.current || !player) return;
    sendingRef.current = true;
    setSubmitState('sending');
    setSubmitNote('');
    const limit = durationSec;
    const taken = limit > 0 ? Math.min(elapsedRef.current, limit) : elapsedRef.current;
    try {
      await submitLiveAnswers(code, player.name, player.phone, answersRef.current, taken);
      localStorage.setItem(doneKey(code), '1');
      setSubmitted(true);
      setSubmitState('idle');
    } catch (e) {
      const codeStr = (e as { code?: string })?.code ?? '';
      if (codeStr.includes('permission-denied')) {
        // Either this phone already submitted (a retry after a flaky network) or the host already ended the test.
        localStorage.setItem(doneKey(code), '1');
        setSubmitted(true);
        setSubmitNote('already-or-closed');
        setSubmitState('idle');
      } else {
        setSubmitState('failed');
        sendingRef.current = false;
      }
    }
  }, [code, player, durationSec]);

  // Auto-submit when the timer runs out.
  useEffect(() => {
    if (isRunning && answers.length > 0 && timeLeft !== null && timeLeft <= 0) void doSubmit();
  }, [isRunning, answers.length, timeLeft, doSubmit]);

  // Host ended the test while this person was still answering → send what they have.
  useEffect(() => {
    if (live?.status === 'ended' && joined && !submitted && answers.length > 0) void doSubmit();
  }, [live?.status, joined, submitted, answers.length, doSubmit]);

  // ── palette handlers (same behaviour as Test.tsx) ──
  const currentQuestion = paper?.questions[step];
  const currentAnswer = currentQuestion ? answers.find((a) => a.questionId === currentQuestion.id) : undefined;

  const goToStep = (index: number) => {
    if (!paper) return;
    const q = paper.questions[index];
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
    if (!currentQuestion || !paper) return;
    setStatusMap((prev) => ({ ...prev, [currentQuestion.id]: isAnswered(currentAnswer) ? 'answered' : 'not-answered' }));
    if (step < paper.questions.length - 1) goToStep(step + 1);
  };
  const markForReview = () => {
    if (!currentQuestion || !paper) return;
    setStatusMap((prev) => ({ ...prev, [currentQuestion.id]: isAnswered(currentAnswer) ? 'answered-marked' : 'marked' }));
    if (step < paper.questions.length - 1) goToStep(step + 1);
  };
  const clearResponse = () => {
    if (!currentQuestion) return;
    setAnswers((prev) =>
      prev.map((a) => (a.questionId === currentQuestion.id ? (a.type === 'mcq' ? { ...a, selectedIndex: null } : { ...a, text: '' }) : a))
    );
    setStatusMap((prev) => ({ ...prev, [currentQuestion.id]: 'not-answered' }));
  };
  const confirmSubmit = () => {
    const unanswered = paper ? paper.questions.length - answers.filter((a) => isAnswered(a)).length : 0;
    const msg = unanswered > 0 ? `${unanswered} question(s) unanswered. Submit anyway?` : 'Submit the test now?';
    if (confirm(msg)) void doSubmit();
  };

  // ── screens ──
  const shell = (children: ReactNode) => (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 md:p-8 flex flex-col items-center justify-center">{children}</div>
  );
  const box = 'w-full max-w-md bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 text-center';

  if (session === 'loading') return shell(<p className="text-gray-400">Loading...</p>);
  if (!live) {
    return shell(
      <div className={box}>
        <p className="font-semibold mb-1">Test not found</p>
        <p className="text-sm text-gray-500 dark:text-white/60">Check the code or link ({code || 'no code'}) and try again.</p>
      </div>
    );
  }

  if (submitted) {
    return shell(
      <div className={box}>
        <p className="text-xl font-bold mb-2">Submitted ✓</p>
        <p className="text-sm text-gray-500 dark:text-white/60">
          {submitNote ? 'Your answers are already recorded (or the test has closed). ' : 'Your answers have been recorded. '}
          The ranking will be shared by your host.
        </p>
      </div>
    );
  }

  if (live.status === 'ended' && !joined) {
    return shell(
      <div className={box}>
        <p className="font-semibold mb-1">{live.title}</p>
        <p className="text-sm text-gray-500 dark:text-white/60">This test has already ended.</p>
      </div>
    );
  }

  if (!joined) {
    return shell(
      <div className={box}>
        <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/40 mb-1">Live test</p>
        <h1 className="text-2xl font-bold mb-1">{live.title}</h1>
        <p className="text-sm text-gray-500 dark:text-white/60 mb-5">
          {live.questions.length} questions{live.durationMinutes > 0 ? ` · ${live.durationMinutes} min` : ''}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="w-full mb-3 px-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:outline-none focus:border-black dark:focus:border-white"
        />
        <input
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          inputMode="numeric"
          placeholder="Phone number (10 digits)"
          className="w-full mb-3 px-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:outline-none focus:border-black dark:focus:border-white"
        />
        {formError && <p className="text-sm text-red-500 mb-3">{formError}</p>}
        <button onClick={handleJoin} disabled={busy} className="w-full py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold disabled:opacity-40">
          {busy ? 'Joining...' : 'Join test'}
        </button>
      </div>
    );
  }

  if (live.status === 'lobby') {
    return shell(
      <div className={box}>
        <p className="font-semibold mb-1">You're in, {player?.name} ✓</p>
        <p className="text-sm text-gray-500 dark:text-white/60">Waiting for the host to start the test. Keep this page open.</p>
      </div>
    );
  }

  if (live.status === 'ended' && answers.length === 0) {
    return shell(
      <div className={box}>
        <p className="font-semibold mb-1">{live.title}</p>
        <p className="text-sm text-gray-500 dark:text-white/60">The host has ended this test.</p>
      </div>
    );
  }

  // running (or ended-while-sending)
  if (!paper || !currentQuestion || answers.length === 0) return shell(<p className="text-gray-400">Loading test...</p>);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 md:p-8">
      {submitState !== 'idle' && (
        <div className="max-w-6xl mx-auto mb-4 px-4 py-3 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm flex items-center justify-between gap-3">
          <span>{submitState === 'sending' ? 'Sending your answers...' : 'Could not send your answers. Check your internet.'}</span>
          {submitState === 'failed' && (
            <button onClick={() => void doSubmit()} className="px-3 py-1.5 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold">
              Retry
            </button>
          )}
        </div>
      )}
      <TakingScreen
        paper={paper}
        step={step}
        currentQuestion={currentQuestion}
        currentAnswer={currentAnswer}
        answers={answers}
        statusMap={statusMap}
        timeLeft={timeLeft}
        secondsElapsed={elapsed}
        onGoToStep={goToStep}
        onSelectMCQ={selectMCQ}
        onSubjectiveText={setSubjectiveText}
        onSaveAndNext={saveAndNext}
        onMarkForReview={markForReview}
        onClearResponse={clearResponse}
        onSubmit={confirmSubmit}
      />
    </div>
  );
}
