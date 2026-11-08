import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, RotateCcw, Square, Users, X } from 'lucide-react';
import type { TestPaper, TestQuestion } from './types';
import {
  buildLeaderboard,
  createLiveSession,
  endLiveSession,
  fetchHostQuestions,
  getSessionOnce,
  splitPlayable,
  subscribeRoster,
  subscribeSession,
  ensureSignedIn,
  addAllowed,
  removeAllowed,
  resetPlayer,
  parseAllowedInput,
  type LiveAllowed,
  type LivePlayer,
  type LiveSession,
  type LiveSubmission,
} from './liveTest';
import { downloadLeaderboardPdf } from './testPdf';
import { askConfirm } from './dialogApi';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';

// ============================================================
// LiveHost.tsx — the host's control room for a Live Test.
//   1. Create session  → 6-character code + join link (live immediately)
//   2. Live            → add allowed numbers any time; each student starts whenever
//                        they like and gets the full time from THEIR own Start.
//                        Stays live until the host presses End.
//   3. Ended           → ranking table + "Download PDF"
// The answer key lives only in the host-only Firestore doc; grading
// happens here, on the host's device, when the results are shown.
// ============================================================

const HOST_KEY = (paperId: string) => `learning_os_live_host_${paperId}`;
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function LiveHost({ paper, onExit }: { paper: TestPaper; onExit: () => void }) {
  const t = useTranslation().liveHost;
  const errKeyRef = useRef(t.errKey); // the effect below must not re-subscribe when the language changes
  errKeyRef.current = t.errKey;
  const { playable, skipped } = useMemo(() => splitPlayable(paper), [paper]);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<LiveSession | null>(null);
  const [players, setPlayers] = useState<LivePlayer[]>([]);
  const [submissions, setSubmissions] = useState<LiveSubmission[]>([]);
  const [allowed, setAllowed] = useState<LiveAllowed[]>([]);
  const [keyQuestions, setKeyQuestions] = useState<TestQuestion[] | null>(null);
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
    const unsubRoster = subscribeRoster(code, setPlayers, setSubmissions, setAllowed);
    void fetchHostQuestions(code).then(setKeyQuestions).catch(() => setError(errKeyRef.current));
    return () => {
      unsubSession();
      unsubRoster();
    };
  }, [code]);

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
      setAllowed([]);
      setCode(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errCreate);
    } finally {
      setBusy(false);
    }
  };

  const takingNow = players.filter((p) => p.startedAtMs && !submissions.some((s) => s.phone === p.phone)).length;

  const handleEnd = async () => {
    if (!code) return;
    const msg =
      takingNow > 0
        ? format(t.confirmTaking, takingNow)
        : allowed.length - submissions.length > 0
          ? format(t.confirmNotTaken, allowed.length - submissions.length)
          : t.confirmEnd;
    if (!(await askConfirm(msg, { danger: true }))) return;
    setBusy(true);
    setError('');
    try {
      await endLiveSession(code);
    } catch {
      setError(t.errEnd);
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
    setAllowed([]);
    setKeyQuestions(null);
  };

  // Everyone on the guest list (even if they never joined) shows up in the ranking sheet.
  const roster = useMemo<LivePlayer[]>(() => {
    const joinedName = new Map(players.map((p) => [p.phone, p.name]));
    const list = allowed.map((a) => ({ phone: a.phone, name: joinedName.get(a.phone) || a.name || a.phone }));
    const known = new Set(allowed.map((a) => a.phone));
    return [...list, ...players.filter((p) => !known.has(p.phone))];
  }, [allowed, players]);

  const rows = useMemo(
    () => (session?.status === 'ended' && keyQuestions ? buildLeaderboard(keyQuestions, roster, submissions) : []),
    [session?.status, keyQuestions, roster, submissions]
  );

  const guestPanel = code ? (
    <GuestList code={code} allowed={allowed} players={players} submissions={submissions} locked={session?.status === 'ended'} onError={setError} />
  ) : null;

  const card = 'card rounded-2xl p-6';
  const primaryBtn = 'px-5 py-3 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white font-semibold transition disabled:opacity-40';

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/60 mb-5 hover:underline">
        <ArrowLeft className="w-4 h-4" /> {t.back}
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">{format(t.title, paper.title)}</h2>
        <p className="text-sm text-gray-500 dark:text-white/60">{t.intro}</p>
      </div>

      {error && <p className="mb-4 px-4 py-3 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">{error}</p>}

      {loading && <p className="text-gray-400">{t.loading}</p>}

      {/* ---------- 1. create ---------- */}
      {!loading && !code && (
        <div className={card}>
          <p className="font-semibold mb-1">{format(t.willUse, playable.length)}</p>
          <p className="text-sm text-gray-500 dark:text-white/60 mb-4">
            {paper.durationMinutes > 0 ? format(t.timerAll, paper.durationMinutes) : t.noTimerEnd}
          </p>
          {skipped > 0 && (
            <p className="text-sm mb-4 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
              {format(t.leftOut, skipped)}
            </p>
          )}
          <button onClick={handleCreate} disabled={busy || playable.length === 0} className={primaryBtn}>
            {busy ? t.creating : t.create}
          </button>
          {playable.length === 0 && <p className="text-sm text-red-500 mt-3">{t.noGradable}</p>}
        </div>
      )}

      {code && !session && <p className="text-gray-400">{t.loadingSession}</p>}

      {/* ---------- 2. live ---------- */}
      {code && session && session.status !== 'ended' && (
        <div className="space-y-5">
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {t.live}
            </p>
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/40 mb-1">{t.joinCode}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-4xl font-mono font-bold tracking-[0.3em]">{code}</span>
              <button onClick={() => copy('code')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm">
                {copied === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {t.copyCode}
              </button>
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/40 mt-5 mb-1">{t.joinLink}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm break-all">{joinLink}</span>
              <button onClick={() => copy('link')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm">
                {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {t.copyLink}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-4">
              {paper.durationMinutes > 0 ? format(t.timerEach, paper.durationMinutes) : t.noTimerEach}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label={t.onList} value={String(allowed.length)} />
            <Stat label={t.takingNow} value={String(takingNow)} />
            <Stat label={t.submitted} value={String(submissions.length)} />
          </div>

          {guestPanel}

          <button onClick={handleEnd} disabled={busy} className={`${primaryBtn} flex items-center gap-2 !bg-red-500 !text-white`}>
            <Square className="w-4 h-4" /> {t.endShow}
          </button>
        </div>
      )}

      {/* ---------- 4. ended ---------- */}
      {code && session?.status === 'ended' && (
        <div className="space-y-5">
          {!keyQuestions ? (
            <p className="text-gray-400">{t.calculating}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label={t.enrolled} value={String(roster.length)} />
                <Stat label={t.submitted} value={String(submissions.length)} />
                <Stat label={t.topScore} value={rows.find((r) => r.submitted) ? `${rows.find((r) => r.submitted)!.obtained}/${session.totalMarks}` : '—'} />
              </div>

              <button
                onClick={() => downloadLeaderboardPdf(session.title, rows, session.totalMarks, players.length, roster.length)}
                className={`${primaryBtn} flex items-center gap-2`}
              >
                <Download className="w-4 h-4" /> {t.downloadPdf}
              </button>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-white/10 text-left">
                    <tr>
                      <th className="px-3 py-2">{t.rank}</th>
                      <th className="px-3 py-2">{t.name}</th>
                      <th className="px-3 py-2">{t.phone}</th>
                      <th className="px-3 py-2 text-right">{t.marks}</th>
                      <th className="px-3 py-2 text-right">{t.time}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.phone} className={`border-t border-gray-200 dark:border-white/10 ${r.submitted ? '' : 'text-gray-400 dark:text-white/40'}`}>
                        <td className="px-3 py-2 font-semibold">{r.rank ?? '—'}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.phone}</td>
                        <td className="px-3 py-2 text-right">{r.submitted ? `${r.obtained}/${r.total}` : t.notSubmitted}</td>
                        <td className="px-3 py-2 text-right">{r.submitted ? formatClock(r.timeTakenSeconds) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={handleNew} className="text-sm underline text-gray-500 dark:text-white/60">
                {t.newSession}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card rounded-2xl p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/40 mb-1">{label}</p>
      <p className="text-2xl font-bold flex items-center justify-center gap-1.5">
        {value}
      </p>
    </div>
  );
}

function GuestList({
  code,
  allowed,
  players,
  submissions,
  locked,
  onError,
}: {
  code: string;
  allowed: LiveAllowed[];
  players: LivePlayer[];
  submissions: LiveSubmission[];
  locked: boolean;
  onError: (m: string) => void;
}) {
  const t = useTranslation().liveHost;
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const joined = new Map(players.map((p) => [p.phone, p.name]));
  const done = new Set(submissions.map((s) => s.phone));

  const add = async () => {
    const { entries, invalid } = parseAllowedInput(text);
    if (entries.length === 0) {
      setNote(invalid.length ? format(t.noValid, invalid.length) : t.typeFirst);
      return;
    }
    setBusy(true);
    onError('');
    try {
      await addAllowed(code, entries);
      setText('');
      setNote(invalid.length ? format(t.addedInvalid, entries.length, invalid.length) : format(t.added, entries.length));
    } catch {
      onError(t.errSaveNumbers);
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...allowed].sort((a, b) => (joined.get(a.phone) || a.name || a.phone).localeCompare(joined.get(b.phone) || b.name || b.phone));
  const joinedCount = allowed.filter((a) => joined.has(a.phone)).length;

  return (
    <div className="card rounded-2xl p-6">
      <p className="flex items-center gap-2 font-semibold mb-1">
        <Users className="w-4 h-4" /> {format(t.allowedTitle, allowed.length, joinedCount)}
      </p>
      <p className="text-xs text-gray-500 dark:text-white/60 mb-3">{t.allowedHint}</p>

      {!locked && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={t.numbersPlaceholder}
            className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black dark:focus:border-white resize-none"
          />
          <div className="flex items-center gap-3 mt-2 mb-4">
            <button onClick={add} disabled={busy} className="px-4 py-2 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm font-semibold disabled:opacity-40">
              {busy ? t.adding : t.addNumbers}
            </button>
            {note && <span className="text-xs text-gray-500 dark:text-white/60">{note}</span>}
          </div>
        </>
      )}

      {sorted.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20">
          {sorted.map((a) => {
            const isJoined = joined.has(a.phone);
            const isDone = done.has(a.phone);
            const label = joined.get(a.phone) || a.name;
            return (
              <div key={a.phone} className="flex items-center justify-between gap-2 px-3 py-2 text-sm border-b last:border-b-0 border-gray-100 dark:border-white/10">
                <div className="min-w-0">
                  <span className="font-medium">{label || a.phone}</span>
                  {label && <span className="text-gray-400 dark:text-white/40"> · {a.phone}</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs ${isDone ? 'text-emerald-600 dark:text-emerald-400' : isJoined ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-white/40'}`}>
                    {isDone ? t.statusSubmitted : isJoined ? t.statusJoined : t.statusNotJoined}
                  </span>
                  {!locked && isJoined && !isDone && (
                    <button
                      onClick={() => void resetPlayer(code, a.phone)}
                      title={t.unlockTitle}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!locked && !isDone && (
                    <button onClick={() => void removeAllowed(code, a.phone)} title={t.removeTitle} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/10 text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
