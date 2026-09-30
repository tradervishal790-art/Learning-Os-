import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock, Copy, Download, Play, Square, Users } from 'lucide-react';
import type { TestPaper, TestQuestion } from './types';
import {
  buildLeaderboard,
  createLiveSession,
  endLiveSession,
  fetchHostQuestions,
  getSessionOnce,
  splitPlayable,
  startLiveSession,
  subscribeRoster,
  subscribeSession,
  ensureSignedIn,
  type LivePlayer,
  type LiveSession,
  type LiveSubmission,
} from './liveTest';
import { downloadLeaderboardPdf } from './testPdf';

// ============================================================
// LiveHost.tsx — the host's control room for a Live Test.
//   1. Create session  → 6-character code + join link
//   2. Lobby           → watch people join, press Start for everyone
//   3. Running         → joined / submitted counters, countdown, End
//   4. Ended           → ranking table + "Download PDF"
// The answer key lives only in the host-only Firestore doc; grading
// happens here, on the host's device, when the results are shown.
// ============================================================

const HOST_KEY = (paperId: string) => `learning_os_live_host_${paperId}`;
const END_GRACE_SECONDS = 20; // let last auto-submits reach Firestore before the host can close

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function LiveHost({ paper, onExit }: { paper: TestPaper; onExit: () => void }) {
  const { playable, skipped } = useMemo(() => splitPlayable(paper), [paper]);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<LiveSession | null>(null);
  const [players, setPlayers] = useState<LivePlayer[]>([]);
  const [submissions, setSubmissions] = useState<LiveSubmission[]>([]);
  const [keyQuestions, setKeyQuestions] = useState<TestQuestion[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  // Resume a session this host already created for this paper (refresh-safe).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const uid = await ensureSignedIn();
        const saved = localStorage.getItem(HOST_KEY(paper.id));
        if (saved) {
          const existing = await getSessionOnce(saved);
          if (!cancelled && existing && existing.hostUid === uid) setCode(saved);
        }
      } catch {
        // no saved session — show the create screen
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paper.id]);

  useEffect(() => {
    if (!code) return;
    const unsubSession = subscribeSession(code, setSession);
    const unsubRoster = subscribeRoster(code, setPlayers, setSubmissions);
    void fetchHostQuestions(code).then(setKeyQuestions).catch(() => setError('Could not load the answer key.'));
    return () => {
      unsubSession();
      unsubRoster();
    };
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const joinLink = code ? `${window.location.origin}/live/${code}` : '';

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? (code ?? '') : joinLink);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked — user can still read/select the text
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const c = await createLiveSession(paper, playable);
      localStorage.setItem(HOST_KEY(paper.id), c);
      setSession(null);
      setPlayers([]);
      setSubmissions([]);
      setCode(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the session.');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!code) return;
    setBusy(true);
    setError('');
    try {
      await startLiveSession(code);
    } catch {
      setError('Could not start the test. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const durationSec = (session?.durationMinutes ?? 0) * 60;
  const elapsed = session?.startedAtMs ? Math.floor((now - session.startedAtMs) / 1000) : 0;
  const timeLeft = durationSec > 0 ? durationSec - elapsed : null;
  const secondsSinceExpiry = timeLeft !== null && timeLeft <= 0 ? -timeLeft : 0;
  const graceLeft = timeLeft !== null && timeLeft <= 0 ? Math.max(0, END_GRACE_SECONDS - secondsSinceExpiry) : 0;

  const handleEnd = async () => {
    if (!code) return;
    const waiting = players.length - submissions.length;
    const msg =
      timeLeft !== null && timeLeft > 0
        ? `Time is still left (${formatClock(timeLeft)}). End the test for everyone now?`
        : waiting > 0
          ? `${waiting} joined person(s) have not submitted. End the test anyway?`
          : 'End the test and show the ranking?';
    if (!confirm(msg)) return;
    setBusy(true);
    setError('');
    try {
      await endLiveSession(code);
    } catch {
      setError('Could not end the test. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleNew = () => {
    localStorage.removeItem(HOST_KEY(paper.id));
    setCode(null);
    setSession(null);
    setPlayers([]);
    setSubmissions([]);
    setKeyQuestions(null);
  };

  const rows = useMemo(
    () => (session?.status === 'ended' && keyQuestions ? buildLeaderboard(keyQuestions, players, submissions) : []),
    [session?.status, keyQuestions, players, submissions]
  );

  const card = 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6';
  const primaryBtn = 'px-5 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold transition disabled:opacity-40';

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/60 mb-5 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to tests
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">Live Test · {paper.title}</h2>
        <p className="text-sm text-gray-500 dark:text-white/60">One test, many people at the same time. Everyone is ranked by marks at the end.</p>
      </div>

      {error && <p className="mb-4 px-4 py-3 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">{error}</p>}

      {loading && <p className="text-gray-400">Loading...</p>}

      {/* ---------- 1. create ---------- */}
      {!loading && !code && (
        <div className={card}>
          <p className="font-semibold mb-1">{playable.length} question{playable.length !== 1 ? 's' : ''} will be used</p>
          <p className="text-sm text-gray-500 dark:text-white/60 mb-4">
            {paper.durationMinutes > 0 ? `Timer: ${paper.durationMinutes} min for everyone.` : 'No timer — you end the test yourself.'}
          </p>
          {skipped > 0 && (
            <p className="text-sm mb-4 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
              {skipped} question(s) left out: they have no answer key, or are short-answer questions that need self-marking.
            </p>
          )}
          <button onClick={handleCreate} disabled={busy || playable.length === 0} className={primaryBtn}>
            {busy ? 'Creating...' : 'Create live session'}
          </button>
          {playable.length === 0 && <p className="text-sm text-red-500 mt-3">This test has no auto-gradable questions yet.</p>}
        </div>
      )}

      {code && !session && <p className="text-gray-400">Loading session...</p>}

      {/* ---------- 2. lobby ---------- */}
      {code && session?.status === 'lobby' && (
        <div className="space-y-5">
          <div className={card}>
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/40 mb-1">Join code</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-4xl font-mono font-bold tracking-[0.3em]">{code}</span>
              <button onClick={() => copy('code')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm">
                {copied === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy code
              </button>
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/40 mt-5 mb-1">Join link (share on WhatsApp / screen)</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm break-all">{joinLink}</span>
              <button onClick={() => copy('link')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm">
                {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy link
              </button>
            </div>
          </div>

          <div className={card}>
            <p className="flex items-center gap-2 font-semibold mb-3">
              <Users className="w-4 h-4" /> {players.length} joined
            </p>
            {players.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/40">Waiting for people to join...</p>
            ) : (
              <div className="max-h-56 overflow-auto flex flex-wrap gap-2">
                {players.map((p) => (
                  <span key={p.phone} className="px-3 py-1 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-sm">
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleStart} disabled={busy || players.length === 0} className={`${primaryBtn} flex items-center gap-2`}>
            <Play className="w-4 h-4" /> Start test for everyone
          </button>
        </div>
      )}

      {/* ---------- 3. running ---------- */}
      {code && session?.status === 'running' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Joined" value={String(players.length)} />
            <Stat label="Submitted" value={`${submissions.length}`} />
            <Stat label={timeLeft !== null ? 'Time left' : 'Elapsed'} value={formatClock(timeLeft !== null ? timeLeft : elapsed)} icon />
          </div>

          <div className="h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${players.length ? Math.min(100, (submissions.length / players.length) * 100) : 0}%` }}
            />
          </div>

          {graceLeft > 0 && <p className="text-sm text-gray-500 dark:text-white/60">Time is up. Waiting {graceLeft}s so everyone's answers reach the server...</p>}

          <button onClick={handleEnd} disabled={busy || graceLeft > 0} className={`${primaryBtn} flex items-center gap-2 !bg-red-500 !text-white`}>
            <Square className="w-4 h-4" /> End test &amp; show ranking
          </button>
          <p className="text-xs text-gray-400 dark:text-white/40">People who join late still get only the remaining time.</p>
        </div>
      )}

      {/* ---------- 4. ended ---------- */}
      {code && session?.status === 'ended' && (
        <div className="space-y-5">
          {!keyQuestions ? (
            <p className="text-gray-400">Calculating ranking...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Joined" value={String(players.length)} />
                <Stat label="Submitted" value={String(submissions.length)} />
                <Stat label="Top score" value={rows.find((r) => r.submitted) ? `${rows.find((r) => r.submitted)!.obtained}/${session.totalMarks}` : '—'} />
              </div>

              <button
                onClick={() => downloadLeaderboardPdf(session.title, rows, session.totalMarks, players.length)}
                className={`${primaryBtn} flex items-center gap-2`}
              >
                <Download className="w-4 h-4" /> Download ranking PDF
              </button>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-white/10 text-left">
                    <tr>
                      <th className="px-3 py-2">Rank</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2 text-right">Marks</th>
                      <th className="px-3 py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.phone} className={`border-t border-gray-200 dark:border-white/10 ${r.submitted ? '' : 'text-gray-400 dark:text-white/40'}`}>
                        <td className="px-3 py-2 font-semibold">{r.rank ?? '—'}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.phone}</td>
                        <td className="px-3 py-2 text-right">{r.submitted ? `${r.obtained}/${r.total}` : 'Not submitted'}</td>
                        <td className="px-3 py-2 text-right">{r.submitted ? formatClock(r.timeTakenSeconds) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={handleNew} className="text-sm underline text-gray-500 dark:text-white/60">
                Start a new live session for this test
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/40 mb-1">{label}</p>
      <p className="text-2xl font-bold flex items-center justify-center gap-1.5">
        {icon && <Clock className="w-4 h-4" />}
        {value}
      </p>
    </div>
  );
}
