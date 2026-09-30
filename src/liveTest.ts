// src/liveTest.ts
//
// Live Test: one host runs the same test for 100+ people at once.
// Everything goes straight to Firestore from the browser (no new /api
// function — Vercel Hobby is already at its 12-function limit).
//
// Firestore layout:
//   liveTests/{code}                  public: title, timer, status, questions WITHOUT answers
//   liveTests/{code}/private/paper    host-only: the same questions WITH the answer key
//   liveTests/{code}/allowed/{phone}  the host's guest list — ONLY these numbers can join
//   liveTests/{code}/players/{phone}  who joined + when they pressed Start (doc id = phone; locked to the first device)
//   liveTests/{code}/submissions/{phone}  final answers (create-only → one submission per phone)
//   liveTests/{code}/done/{phone}     tiny marker so a finished student cannot re-open the test
//
// Participants never receive the answer key. The host's device grades
// everyone at the end, so nobody can read the key from the network tab.
// Phone numbers are NOT OTP-verified (SMS auth needs the Blaze plan, which
// this project avoids) — the number is only an identifier shown in the PDF.
import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocFromServer,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from './firebase';
import type { TestPaper, TestQuestion, TestUserAnswer } from './types';
import { buildInitialResults, computeObtainedMarks, computeTotalMarks, isAnswered } from './testGrading';

export type LiveStatus = 'lobby' | 'running' | 'ended';

export interface LiveSession {
  code: string;
  hostUid: string;
  title: string;
  topic: string;
  durationMinutes: number;
  status: LiveStatus;
  startedAtMs: number | null;
  /** Public copy — no correct answers inside. */
  questions: TestQuestion[];
  totalMarks: number;
}

export interface LivePlayer {
  phone: string;
  name: string;
  /** Server time (ms) when this student pressed Start; null = joined but not started yet. */
  startedAtMs?: number | null;
}

export interface LiveAllowed {
  phone: string;
  name: string; // optional label typed by the host ('' if none)
}

export interface LiveSubmission {
  phone: string;
  name: string;
  answers: TestUserAnswer[];
  timeTakenSeconds: number;
}

export interface LiveRow {
  rank: number | null; // null = did not submit
  name: string;
  phone: string;
  submitted: boolean;
  obtained: number;
  total: number;
  percent: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeTakenSeconds: number;
}

// ---------- helpers ----------

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mix-ups

function generateCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

/** Firestore rejects `undefined` — round-trip through JSON to drop it. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Accepts 9876543210, +91 98765 43210, 09876543210 … returns the 10 digits or null. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Only questions that can be graded automatically can be used in a live test
 *  (MCQ with an answer key, or short-answer with accepted answers). */
export function splitPlayable(paper: TestPaper): { playable: TestQuestion[]; skipped: number } {
  const playable = paper.questions.filter((q) =>
    q.type === 'mcq' ? q.correctIndex >= 0 : q.acceptedAnswers !== undefined && q.modelAnswer.trim() !== ''
  );
  return { playable, skipped: paper.questions.length - playable.length };
}

function publicQuestion(q: TestQuestion): TestQuestion {
  return q.type === 'mcq'
    ? { id: q.id, type: 'mcq', question: q.question, options: q.options, correctIndex: -1, explanation: '', marks: q.marks, negativeMarks: q.negativeMarks }
    : { id: q.id, type: 'subjective', question: q.question, modelAnswer: '', explanation: '', marks: q.marks };
}

export async function ensureSignedIn(): Promise<string> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

// ---------- host ----------

export async function createLiveSession(paper: TestPaper, questions: TestQuestion[]): Promise<string> {
  const uid = await ensureSignedIn();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const ref = doc(db, 'liveTests', code);
    if ((await getDoc(ref)).exists()) continue;
    await setDoc(ref, {
      ...clean({
        hostUid: uid,
        title: paper.title,
        topic: paper.topic,
        durationMinutes: paper.durationMinutes,
        status: 'running', // live from the moment it is created — each student starts on their own
        questions: questions.map(publicQuestion),
        totalMarks: computeTotalMarks(questions),
      }),
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'liveTests', code, 'private', 'paper'), clean({ questions }));
    return code;
  }
  throw new Error('Could not create a unique code — please try again.');
}

export async function endLiveSession(code: string): Promise<void> {
  await updateDoc(doc(db, 'liveTests', code), { status: 'ended', endedAt: serverTimestamp() });
}

export async function fetchHostQuestions(code: string): Promise<TestQuestion[] | null> {
  const snap = await getDoc(doc(db, 'liveTests', code, 'private', 'paper'));
  return snap.exists() ? ((snap.data().questions as TestQuestion[]) ?? null) : null;
}

export async function getSessionOnce(code: string): Promise<LiveSession | null> {
  const snap = await getDoc(doc(db, 'liveTests', code));
  return snap.exists() ? mapSession(code, snap.data({ serverTimestamps: 'estimate' })) : null;
}

export function subscribeRoster(
  code: string,
  onPlayers: (p: LivePlayer[]) => void,
  onSubmissions: (s: LiveSubmission[]) => void,
  onAllowed: (a: LiveAllowed[]) => void
): Unsubscribe {
  const u1 = onSnapshot(
    collection(db, 'liveTests', code, 'players'),
    (snap) =>
      onPlayers(
        snap.docs.map((d) => {
          const st = d.data().startedAt as { toMillis?: () => number } | null | undefined;
          return { phone: d.id, name: String(d.data().name ?? ''), startedAtMs: st && typeof st.toMillis === 'function' ? st.toMillis() : null };
        })
      ),
    (e) => console.warn('players listener', e)
  );
  const u2 = onSnapshot(
    collection(db, 'liveTests', code, 'submissions'),
    (snap) =>
      onSubmissions(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            phone: d.id,
            name: String(x.name ?? ''),
            answers: (x.answers as TestUserAnswer[]) ?? [],
            timeTakenSeconds: Number(x.timeTakenSeconds ?? 0),
          };
        })
      ),
    (e) => console.warn('submissions listener', e)
  );
  const u3 = onSnapshot(
    collection(db, 'liveTests', code, 'allowed'),
    (snap) => onAllowed(snap.docs.map((d) => ({ phone: d.id, name: String(d.data().name ?? '') }))),
    (e) => console.warn('allowed listener', e)
  );
  return () => {
    u1();
    u2();
    u3();
  };
}

// ---------- host: guest list ----------

/** Turns pasted text into phone entries. Accepts one number per line, "Name, number", or many numbers separated by commas/spaces. */
export function parseAllowedInput(text: string): { entries: LiveAllowed[]; invalid: string[] } {
  const entries = new Map<string, LiveAllowed>();
  const invalid: string[] = [];
  const NUM = /\+?\d[\d\s-]{8,}\d/g;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const hasLetters = /\p{L}/u.test(line);
    const matches = line.match(NUM) ?? [];
    if (matches.length === 0) {
      invalid.push(line);
      continue;
    }
    const used = hasLetters ? matches.slice(0, 1) : matches;
    for (const m of used) {
      const phone = normalizePhone(m);
      if (!phone) {
        invalid.push(m.trim());
        continue;
      }
      const name = hasLetters ? line.replace(m, ' ').replace(/[,;:|\-]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
      entries.set(phone, { phone, name });
    }
  }
  return { entries: [...entries.values()], invalid };
}

export async function addAllowed(code: string, entries: LiveAllowed[]): Promise<void> {
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    for (const e of entries.slice(i, i + 400)) {
      batch.set(doc(db, 'liveTests', code, 'allowed', e.phone), { phone: e.phone, name: e.name });
    }
    await batch.commit();
  }
}

export async function removeAllowed(code: string, phone: string): Promise<void> {
  await deleteDoc(doc(db, 'liveTests', code, 'allowed', phone));
}

/** Frees a number that is locked to a lost/dead device so the student can join again. */
export async function resetPlayer(code: string, phone: string): Promise<void> {
  await deleteDoc(doc(db, 'liveTests', code, 'players', phone));
}

// ---------- shared ----------

function mapSession(code: string, x: Record<string, unknown>): LiveSession {
  const started = x.startedAt as { toMillis?: () => number } | null | undefined;
  return {
    code,
    hostUid: String(x.hostUid ?? ''),
    title: String(x.title ?? ''),
    topic: String(x.topic ?? ''),
    durationMinutes: Number(x.durationMinutes ?? 0),
    status: (x.status as LiveStatus) ?? 'lobby',
    startedAtMs: started && typeof started.toMillis === 'function' ? started.toMillis() : null,
    questions: (x.questions as TestQuestion[]) ?? [],
    totalMarks: Number(x.totalMarks ?? 0),
  };
}

export function subscribeSession(code: string, onData: (s: LiveSession | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'liveTests', code),
    (snap) => onData(snap.exists() ? mapSession(code, snap.data({ serverTimestamps: 'estimate' })) : null),
    (e) => {
      console.warn('session listener', e);
      onData(null);
    }
  );
}

// ---------- participant ----------

export type JoinFailure = 'NOT_ALLOWED' | 'ALREADY_DONE' | 'OTHER_DEVICE';

export class JoinError extends Error {
  reason: JoinFailure;
  constructor(reason: JoinFailure) {
    super(reason);
    this.reason = reason;
  }
}

/** Checks the host's guest list and registers the participant. Returns the name to use,
 *  (server clock − device clock) in ms, and — if this student already pressed Start earlier
 *  (refresh / reopened page) — when they started, so the countdown carries on. */
export async function joinLiveSession(
  code: string,
  typedName: string,
  phone: string
): Promise<{ offsetMs: number; name: string; startedAtMs: number | null }> {
  const uid = await ensureSignedIn();
  const allowedSnap = await getDoc(doc(db, 'liveTests', code, 'allowed', phone));
  if (!allowedSnap.exists()) throw new JoinError('NOT_ALLOWED');
  if ((await getDoc(doc(db, 'liveTests', code, 'done', phone))).exists()) throw new JoinError('ALREADY_DONE');

  const hostName = String(allowedSnap.data().name ?? '').trim();
  const name = hostName || typedName;
  const ref = doc(db, 'liveTests', code, 'players', phone);
  const before = Date.now();
  try {
    // merge: a returning student keeps the startedAt they already have
    await setDoc(ref, { uid, name, phone, joinedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    if ((e as { code?: string })?.code?.includes('permission-denied')) throw new JoinError('OTHER_DEVICE');
    throw e;
  }
  return readClock(ref, before, name, 'joinedAt');
}

async function readClock(
  ref: ReturnType<typeof doc>,
  before: number,
  name: string,
  stamped: 'joinedAt' | 'startedAt'
): Promise<{ offsetMs: number; name: string; startedAtMs: number | null }> {
  try {
    const snap = await getDocFromServer(ref);
    const x = snap.data();
    const stampedAt = x?.[stamped] as { toMillis?: () => number } | undefined; // the field this call just wrote
    const st = x?.startedAt as { toMillis?: () => number } | undefined;
    return {
      offsetMs: stampedAt && typeof stampedAt.toMillis === 'function' ? stampedAt.toMillis() - (before + Date.now()) / 2 : 0,
      name,
      startedAtMs: st && typeof st.toMillis === 'function' ? st.toMillis() : null,
    };
  } catch {
    return { offsetMs: 0, name, startedAtMs: null }; // offset 0 is fine — only a few seconds off at worst
  }
}

/** The student pressed Start: the server stamps the time, so the personal timer cannot be reset. */
export async function beginLiveAttempt(code: string, phone: string): Promise<{ offsetMs: number; startedAtMs: number | null }> {
  await ensureSignedIn();
  const ref = doc(db, 'liveTests', code, 'players', phone);
  const before = Date.now();
  await updateDoc(ref, { startedAt: serverTimestamp() });
  const r = await readClock(ref, before, '', 'startedAt');
  return { offsetMs: r.offsetMs, startedAtMs: r.startedAtMs };
}

export async function submitLiveAnswers(
  code: string,
  name: string,
  phone: string,
  answers: TestUserAnswer[],
  timeTakenSeconds: number
): Promise<void> {
  const uid = await ensureSignedIn();
  const batch = writeBatch(db);
  batch.set(doc(db, 'liveTests', code, 'submissions', phone), {
    uid,
    name,
    phone,
    answers: clean(answers),
    timeTakenSeconds,
    submittedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'liveTests', code, 'done', phone), { uid, phone });
  await batch.commit();
}

// ---------- ranking ----------

/** Grades everyone against the host's answer key and ranks by marks, then faster time.
 *  People who joined but never submitted are listed last with rank null. */
export function buildLeaderboard(questions: TestQuestion[], players: LivePlayer[], submissions: LiveSubmission[]): LiveRow[] {
  const total = computeTotalMarks(questions);
  const submitted: LiveRow[] = submissions.map((s) => {
    const results = buildInitialResults(questions, s.answers);
    const obtained = computeObtainedMarks(results);
    const byId = new Map(s.answers.map((a) => [a.questionId, a]));
    const attempted = questions.filter((q) => isAnswered(byId.get(q.id))).length;
    const correct = results.filter((r) => r.isCorrect === true).length;
    return {
      rank: 0,
      name: s.name,
      phone: s.phone,
      submitted: true,
      obtained,
      total,
      percent: total > 0 ? Math.max(0, Math.round((obtained / total) * 100)) : 0,
      correct,
      wrong: Math.max(0, attempted - correct),
      unattempted: questions.length - attempted,
      timeTakenSeconds: s.timeTakenSeconds,
    };
  });

  submitted.sort((a, b) => b.obtained - a.obtained || a.timeTakenSeconds - b.timeTakenSeconds || a.name.localeCompare(b.name));
  submitted.forEach((row, i) => {
    const prev = submitted[i - 1];
    row.rank = prev && prev.obtained === row.obtained && prev.timeTakenSeconds === row.timeTakenSeconds ? (prev.rank as number) : i + 1;
  });

  const done = new Set(submissions.map((s) => s.phone));
  const absent: LiveRow[] = players
    .filter((p) => !done.has(p.phone))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      rank: null,
      name: p.name,
      phone: p.phone,
      submitted: false,
      obtained: 0,
      total,
      percent: 0,
      correct: 0,
      wrong: 0,
      unattempted: questions.length,
      timeTakenSeconds: 0,
    }));

  return [...submitted, ...absent];
}
