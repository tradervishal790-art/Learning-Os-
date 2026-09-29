// src/testAnalytics.ts
//
// Pure, on-device analysis of test attempts — NO AI, no network. Two layers:
//   analyzeAttempt()  → what happened in ONE test
//   analyzeHistory()  → patterns across ALL tests up to that one (topics, repeated
//                       mistakes, guessing, skipping, fatigue, trend)
// The AI (testInsightApi.ts) only ever receives this computed summary and turns it
// into ONE suggestion; every number and finding here is computed locally.
import type { TestAttempt, TestQuestion } from './types';
import { normalizeAnswer, isAnswered } from './testGrading';

export type Severity = 'good' | 'info' | 'warn';
export interface Finding {
  severity: Severity;
  text: string;
}

interface TypeStats {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
}

export interface AttemptStats {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  pending: number; // subjective answers not graded yet
  attempted: number;
  accuracy: number; // % of attempted that were correct
  attemptRate: number; // % of questions attempted
  negativeLost: number; // marks lost to negative marking
  mcq: TypeStats;
  subjective: TypeStats;
  firstHalfAccuracy: number | null;
  secondHalfAccuracy: number | null;
  skippedInLastQuarter: number;
  secondsPerQuestion: number;
  findings: Finding[];
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const emptyType = (): TypeStats => ({ total: 0, correct: 0, wrong: 0, skipped: 0 });

export function analyzeAttempt(attempt: TestAttempt): AttemptStats {
  const answersById = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const resultsById = new Map(attempt.results.map((r) => [r.questionId, r]));
  const mcq = emptyType();
  const subjective = emptyType();
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let pending = 0;
  let negativeLost = 0;
  const outcomes: ('correct' | 'wrong' | 'skipped' | 'pending')[] = [];

  attempt.questions.forEach((q) => {
    const bucket = q.type === 'mcq' ? mcq : subjective;
    bucket.total++;
    const r = resultsById.get(q.id);
    const answered = isAnswered(answersById.get(q.id));
    if (r && r.marksObtained < 0) negativeLost += -r.marksObtained;
    if (!answered) {
      skipped++;
      bucket.skipped++;
      outcomes.push('skipped');
    } else if (r?.isCorrect === true) {
      correct++;
      bucket.correct++;
      outcomes.push('correct');
    } else if (r?.isCorrect === false) {
      wrong++;
      bucket.wrong++;
      outcomes.push('wrong');
    } else {
      pending++;
      outcomes.push('pending');
    }
  });

  const total = attempt.questions.length;
  const attempted = correct + wrong;
  const half = Math.floor(total / 2);
  const acc = (slice: typeof outcomes) => {
    const c = slice.filter((o) => o === 'correct').length;
    const w = slice.filter((o) => o === 'wrong').length;
    return c + w >= 3 ? pct(c, c + w) : null; // too few to say anything
  };
  const firstHalfAccuracy = total >= 6 ? acc(outcomes.slice(0, half)) : null;
  const secondHalfAccuracy = total >= 6 ? acc(outcomes.slice(half)) : null;
  const lastQ = outcomes.slice(Math.ceil(total * 0.75));
  const skippedInLastQuarter = lastQ.filter((o) => o === 'skipped').length;

  const stats: AttemptStats = {
    total,
    correct,
    wrong,
    skipped,
    pending,
    attempted,
    accuracy: pct(correct, attempted),
    attemptRate: pct(attempted + pending, total),
    negativeLost,
    mcq,
    subjective,
    firstHalfAccuracy,
    secondHalfAccuracy,
    skippedInLastQuarter,
    secondsPerQuestion: total > 0 ? Math.round(attempt.timeTakenSeconds / total) : 0,
    findings: [],
  };
  stats.findings = attemptFindings(stats);
  return stats;
}

function attemptFindings(s: AttemptStats): Finding[] {
  const f: Finding[] = [];
  if (s.attempted >= 5) {
    if (s.accuracy >= 85) f.push({ severity: 'good', text: `Strong accuracy — ${s.accuracy}% of the questions you attempted were right.` });
    else if (s.accuracy < 50) f.push({ severity: 'warn', text: `Only ${s.accuracy}% of your attempted answers were right — the basics of this topic need revision.` });
  }
  if (s.negativeLost > 0 && s.mcq.wrong > 0) {
    f.push({ severity: 'warn', text: `${s.mcq.wrong} wrong MCQ answer(s) cost you ${s.negativeLost} mark(s) in negative marking.` });
  }
  if (s.skipped > 0 && s.total > 0 && pct(s.skipped, s.total) >= 25) {
    f.push({ severity: 'warn', text: `You left ${s.skipped} of ${s.total} questions blank (${pct(s.skipped, s.total)}%).` });
  }
  if (s.skippedInLastQuarter >= 2 && s.skippedInLastQuarter >= Math.ceil(s.skipped * 0.6)) {
    f.push({ severity: 'warn', text: `Most blanks are near the end of the paper — you may be running out of time.` });
  }
  if (s.firstHalfAccuracy !== null && s.secondHalfAccuracy !== null && s.firstHalfAccuracy - s.secondHalfAccuracy >= 20) {
    f.push({ severity: 'warn', text: `Accuracy dropped from ${s.firstHalfAccuracy}% in the first half to ${s.secondHalfAccuracy}% in the second — tiredness or rushing late in the test.` });
  }
  const mcqAtt = s.mcq.correct + s.mcq.wrong;
  const subAtt = s.subjective.correct + s.subjective.wrong;
  if (mcqAtt >= 4 && subAtt >= 3 && Math.abs(pct(s.mcq.correct, mcqAtt) - pct(s.subjective.correct, subAtt)) >= 25) {
    const better = pct(s.mcq.correct, mcqAtt) > pct(s.subjective.correct, subAtt) ? 'MCQs' : 'written answers';
    f.push({ severity: 'info', text: `You do noticeably better on ${better} than on the other question type.` });
  }
  if (s.pending > 0) f.push({ severity: 'info', text: `${s.pending} written answer(s) are not graded yet — grade them for a complete picture.` });
  return f;
}

// ---------------------------------------------------------------- history

export interface TopicStats {
  topic: string;
  attempts: number;
  avgScore: number;
  latestScore: number;
}

export interface RepeatedMiss {
  question: string;
  seen: number;
  missed: number;
  topic: string;
  /** Same wrong option picked every time (MCQ) — a sticky misconception, not a slip. */
  sameWrongOption: boolean;
}

export type Trend = 'improving' | 'declining' | 'steady';

export interface HistoryStats {
  attempts: number;
  avgScore: number;
  trend: Trend | null; // null when fewer than 3 tests
  scores: number[]; // oldest → newest
  topics: TopicStats[]; // weakest first
  repeatedMisses: RepeatedMiss[];
  avgAccuracy: number;
  avgAttemptRate: number;
  totalNegativeLost: number;
  findings: Finding[];
}

const qKey = (q: TestQuestion) => normalizeAnswer(q.question).slice(0, 200);
const clip = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/** attempts may be in any order and may or may not include `current`; only tests up to and including `current` are used. */
export function analyzeHistory(current: TestAttempt, attempts: TestAttempt[]): HistoryStats {
  const upTo = [...attempts.filter((a) => a.id !== current.id), current]
    .filter((a) => a.completedAt <= current.completedAt)
    .sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1));

  const scores = upTo.map((a) => a.scorePercent);
  const perAttempt = upTo.map(analyzeAttempt);

  // trend: last 3 vs the (up to) 3 before them
  let trend: Trend | null = null;
  if (upTo.length >= 3) {
    const recent = scores.slice(-3);
    const before = scores.slice(Math.max(0, scores.length - 6), -3);
    const diff = avg(recent) - (before.length ? avg(before) : scores[0]);
    trend = diff >= 5 ? 'improving' : diff <= -5 ? 'declining' : 'steady';
  }

  // topics
  const byTopic = new Map<string, TestAttempt[]>();
  upTo.forEach((a) => {
    const key = a.topic?.trim() || a.testTitle;
    byTopic.set(key, [...(byTopic.get(key) ?? []), a]);
  });
  const topics: TopicStats[] = [...byTopic.entries()]
    .map(([topic, list]) => ({ topic, attempts: list.length, avgScore: avg(list.map((a) => a.scorePercent)), latestScore: list[list.length - 1].scorePercent }))
    .sort((a, b) => a.avgScore - b.avgScore);

  // repeated misses: same question seen in more than one attempt and missed more than once
  interface Seen { text: string; topic: string; seen: number; missed: number; wrongPicks: number[] }
  const seenMap = new Map<string, Seen>();
  upTo.forEach((a) => {
    const resultsById = new Map(a.results.map((r) => [r.questionId, r]));
    const answersById = new Map(a.answers.map((x) => [x.questionId, x]));
    a.questions.forEach((q) => {
      const r = resultsById.get(q.id);
      if (!r || r.isCorrect === null) return; // ungraded — not evidence either way
      const k = qKey(q);
      if (!k) return;
      const e = seenMap.get(k) ?? { text: q.question, topic: a.topic?.trim() || a.testTitle, seen: 0, missed: 0, wrongPicks: [] };
      e.seen++;
      if (r.isCorrect === false) {
        e.missed++;
        const ans = answersById.get(q.id);
        if (q.type === 'mcq' && ans && ans.type === 'mcq' && ans.selectedIndex !== null) e.wrongPicks.push(ans.selectedIndex);
      }
      seenMap.set(k, e);
    });
  });
  const repeatedMisses: RepeatedMiss[] = [...seenMap.values()]
    .filter((e) => e.seen >= 2 && e.missed >= 2)
    .map((e) => ({
      question: clip(e.text),
      seen: e.seen,
      missed: e.missed,
      topic: e.topic,
      sameWrongOption: e.wrongPicks.length >= 2 && new Set(e.wrongPicks).size === 1,
    }))
    .sort((a, b) => b.missed - a.missed || b.missed / b.seen - a.missed / a.seen)
    .slice(0, 6);

  const avgAccuracy = avg(perAttempt.filter((s) => s.attempted > 0).map((s) => s.accuracy));
  const avgAttemptRate = avg(perAttempt.map((s) => s.attemptRate));
  const totalNegativeLost = perAttempt.reduce((n, s) => n + s.negativeLost, 0);

  const h: HistoryStats = { attempts: upTo.length, avgScore: avg(scores), trend, scores, topics, repeatedMisses, avgAccuracy, avgAttemptRate, totalNegativeLost, findings: [] };
  h.findings = historyFindings(h, perAttempt);
  return h;
}

function historyFindings(h: HistoryStats, per: AttemptStats[]): Finding[] {
  const f: Finding[] = [];
  if (h.attempts < 2) return f;

  if (h.trend === 'improving') f.push({ severity: 'good', text: `Your scores are going up across recent tests (${h.scores.slice(-3).join('% → ')}%).` });
  else if (h.trend === 'declining') f.push({ severity: 'warn', text: `Your scores are slipping across recent tests (${h.scores.slice(-3).join('% → ')}%).` });
  else if (h.trend === 'steady' && h.attempts >= 4) f.push({ severity: 'info', text: `Your scores are steady around ${avg(h.scores.slice(-3))}% — practice alone isn't moving them; target the weak areas below.` });

  const weak = h.topics.filter((t) => t.avgScore < 60);
  if (h.topics.length >= 2 && weak.length > 0) {
    f.push({ severity: 'warn', text: `Weakest topic${weak.length > 1 ? 's' : ''}: ${weak.slice(0, 3).map((t) => `${t.topic} (avg ${t.avgScore}%)`).join(', ')}.` });
  } else if (h.topics.length === 1 && h.topics[0].avgScore < 60) {
    f.push({ severity: 'warn', text: `Average on ${h.topics[0].topic} is only ${h.topics[0].avgScore}% across ${h.topics[0].attempts} tests.` });
  }
  const strong = [...h.topics].reverse().find((t) => t.avgScore >= 80);
  if (strong && h.topics.length >= 2) f.push({ severity: 'good', text: `Strongest topic: ${strong.topic} (avg ${strong.avgScore}%).` });

  if (h.repeatedMisses.length > 0) {
    const sticky = h.repeatedMisses.filter((m) => m.sameWrongOption).length;
    f.push({
      severity: 'warn',
      text: `${h.repeatedMisses.length} question(s) you keep getting wrong across tests${sticky > 0 ? ` — ${sticky} of them with the SAME wrong option each time, which means a concept is misunderstood, not a slip` : ''}.`,
    });
  }

  const guessy = per.filter((s) => s.mcq.wrong >= 3 && s.mcq.wrong / Math.max(1, s.mcq.correct + s.mcq.wrong) >= 0.4).length;
  if (guessy >= 2 && h.totalNegativeLost > 0) f.push({ severity: 'warn', text: `In ${guessy} tests you lost marks to wrong MCQ guesses — ${h.totalNegativeLost} marks in total. Skipping unsure questions would have saved them.` });

  const blanky = per.filter((s) => pct(s.skipped, s.total) >= 25).length;
  if (blanky >= 2) f.push({ severity: 'warn', text: `You left 25%+ of the paper blank in ${blanky} of ${per.length} tests.` });

  const fatigue = per.filter((s) => s.firstHalfAccuracy !== null && s.secondHalfAccuracy !== null && s.firstHalfAccuracy - s.secondHalfAccuracy >= 20).length;
  if (fatigue >= 2) f.push({ severity: 'warn', text: `Your accuracy falls in the second half of the paper in ${fatigue} tests — a stamina / pacing habit.` });

  const late = per.filter((s) => s.skippedInLastQuarter >= 2).length;
  if (late >= 2) f.push({ severity: 'warn', text: `You leave the last questions blank in ${late} tests — time runs out before the paper ends.` });

  return f;
}

/** Compact, number-only summary handed to the AI. No answers, no personal data. */
export function buildInsightPayload(current: TestAttempt, a: AttemptStats, h: HistoryStats) {
  return {
    thisTest: {
      title: current.testTitle,
      topic: current.topic,
      scorePercent: current.scorePercent,
      correct: a.correct,
      wrong: a.wrong,
      skipped: a.skipped,
      accuracyOfAttempted: a.accuracy,
      negativeMarksLost: a.negativeLost,
      firstHalfAccuracy: a.firstHalfAccuracy,
      secondHalfAccuracy: a.secondHalfAccuracy,
      secondsPerQuestion: a.secondsPerQuestion,
      findings: a.findings.map((x) => x.text),
    },
    history: {
      testsTaken: h.attempts,
      averageScore: h.avgScore,
      trend: h.trend,
      recentScores: h.scores.slice(-8),
      topics: h.topics.slice(0, 6).map((t) => ({ topic: t.topic, tests: t.attempts, avg: t.avgScore, latest: t.latestScore })),
      repeatedMisses: h.repeatedMisses.map((m) => ({ question: m.question, seen: m.seen, missed: m.missed, sameWrongOption: m.sameWrongOption })),
      findings: h.findings.map((x) => x.text),
    },
  };
}

export type InsightPayload = ReturnType<typeof buildInsightPayload>;
