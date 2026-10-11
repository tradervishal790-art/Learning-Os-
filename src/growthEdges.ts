// src/growthEdges.ts
//
// "Growth edges" = personality tendency (Personality Check score bucket) CONFIRMED by
// real test behaviour. Rules (from the Growth Gaps doc):
//   - Trait predicts, behaviour confirms: an edge needs BOTH a score bucket's gap
//     (src/gapsData.ts) AND a matching signal in the learner's tests. An "unsure"
//     trait never produces an edge. Near a bucket boundary (<=3 pts) both
//     neighbouring buckets are checked. Push: ends strong, leaning light, middle minimal.
//   - One edge per trait, at most 3 shown, strongest trait extremes first.
//   - Gentle wording ("growth edge"), honest numbers in the evidence line.
// Pure, on-device, no AI.
import type { AttemptStats, HistoryStats } from './testAnalytics';
import type { PersonalityProfile, Bucket } from './personalityScoring';
import { BUCKET_GAPS, type SignalKey } from './gapsData';
import type { Trait } from './personalityQuestions';
import type { BehaviourStats } from './behaviourStats';

export interface GrowthEdge {
  trait: Trait;
  title: string; // what goes wrong
  cause: string; // why it happens
  action: string; // what to try next
  evidence: string; // the real numbers from their tests
  source: 'test' | 'activity'; // where the confirming evidence came from
  bucket: Bucket; // the score bucket (1-5) that produced this edge
  push: 'strong' | 'light' | 'minimal'; // 1/5 strong, 2/4 light, 3 minimal (behaviour leads)
}

type ActivitySignalKey = 'revisionOverdue' | 'streakBroken' | 'watchNotPractise' | 'manyOpenTopics';
const ACTIVITY_KEYS: SignalKey[] = ['revisionOverdue', 'streakBroken', 'watchNotPractise', 'manyOpenTopics'];

type Signals = {
  blank: string | null;
  lateBlank: string | null;
  fatigue: string | null;
  careless: string | null;
  lowAccuracy: string | null;
  overAttempt: string | null;
  repeatedMiss: string | null;
  sticky: string | null;
  declining: string | null;
  plateau: string | null;
  weakTopics: string | null;
  scoreDrop: string | null;
};

function deriveActivitySignals(h: HistoryStats, b: BehaviourStats | null): Record<ActivitySignalKey, string | null> {
  if (!b) return { revisionOverdue: null, streakBroken: null, watchNotPractise: null, manyOpenTopics: null };
  return {
    revisionOverdue: b.overdueRevisions >= 2 ? `${b.overdueRevisions} revision checkpoints are overdue.` : null,
    streakBroken: b.totalActiveDays >= 4 && b.currentStreak === 0 ? `Your streak is at 0 after ${b.totalActiveDays} active days.` : null,
    watchNotPractise:
      b.watchMinutes7d >= 120 && h.attempts >= 1 && h.avgAccuracy < 60
        ? `${Math.round(b.watchMinutes7d / 60 * 10) / 10} hours watched this week, but test accuracy is ${h.avgAccuracy}%.`
        : null,
    manyOpenTopics: b.learningTopics >= 3 ? `${b.learningTopics} topics are started but not finished.` : null,
  };
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Each signal is null when absent, or a short evidence sentence when present. */
function deriveSignals(a: AttemptStats, h: HistoryStats): Signals {
  const prev = h.scores.slice(0, -1);
  const prevAvg = prev.length ? Math.round(prev.reduce((x, y) => x + y, 0) / prev.length) : null;
  const last = h.scores[h.scores.length - 1];
  const weak = h.topics.filter((t) => t.avgScore < 60);
  return {
    blank: a.total > 0 && pct(a.skipped, a.total) >= 25 ? `${a.skipped} of ${a.total} questions left blank in this test.` : null,
    lateBlank: a.skippedInLastQuarter >= 2 ? `${a.skippedInLastQuarter} blanks in the last quarter of the paper.` : null,
    fatigue:
      a.firstHalfAccuracy !== null && a.secondHalfAccuracy !== null && a.firstHalfAccuracy - a.secondHalfAccuracy >= 20
        ? `Accuracy fell from ${a.firstHalfAccuracy}% to ${a.secondHalfAccuracy}% in the second half.`
        : null,
    careless: a.negativeLost > 0 && a.mcq.wrong >= 3 ? `${a.mcq.wrong} wrong MCQs cost ${a.negativeLost} mark(s).` : null,
    lowAccuracy: a.attempted >= 5 && a.accuracy < 60 ? `Only ${a.accuracy}% of attempted answers were right.` : null,
    overAttempt:
      a.attempted >= 5 && a.attemptRate >= 95 && a.accuracy < 60 ? `You attempted ${a.attemptRate}% of the paper, but ${a.accuracy}% was right.` : null,
    repeatedMiss: h.repeatedMisses.length > 0 ? `${h.repeatedMisses.length} question(s) missed again across tests.` : null,
    sticky: h.repeatedMisses.some((m) => m.sameWrongOption) ? 'The same wrong option was picked again on repeated questions.' : null,
    declining: h.trend === 'declining' ? `Recent scores: ${h.scores.slice(-3).join('% → ')}%.` : null,
    plateau: h.trend === 'steady' && h.attempts >= 4 && h.avgScore < 60 ? `Scores steady around ${h.avgScore}% over ${h.attempts} tests.` : null,
    weakTopics:
      h.topics.length >= 2 && weak.length > 0 ? `Weakest: ${weak.slice(0, 2).map((t) => `${t.topic} (${t.avgScore}%)`).join(', ')}.` : null,
    scoreDrop:
      prevAvg !== null && last <= prevAvg - 15 ? `Latest score ${last}% vs your earlier average ${prevAvg}%.` : null,
  };
}

// Most specific signal first, so a rare, sharp signal beats a generic one.
const SPECIFICITY: SignalKey[] = [
  'sticky', 'repeatedMiss', 'scoreDrop', 'declining', 'overAttempt', 'careless',
  'fatigue', 'lateBlank', 'blank', 'weakTopics', 'plateau', 'lowAccuracy',
  'revisionOverdue', 'manyOpenTopics', 'watchNotPractise', 'streakBroken', 'later',
];
const rank = (s: SignalKey) => SPECIFICITY.indexOf(s);
const pushOf = (b: Bucket): GrowthEdge['push'] => (b === 1 || b === 5 ? 'strong' : b === 3 ? 'minimal' : 'light');
const PUSH_WEIGHT = { strong: 2, light: 1, minimal: 0 } as const;

export function computeGrowthEdges(profile: PersonalityProfile | null, a: AttemptStats, h: HistoryStats, behaviour: BehaviourStats | null = null): GrowthEdge[] {
  if (!profile) return [];
  const signals: Record<string, string | null> = { ...deriveSignals(a, h), ...deriveActivitySignals(h, behaviour) };
  const found: { edge: GrowthEdge; weight: number; extremity: number }[] = [];

  for (const [trait, r] of Object.entries(profile.traits) as [Trait, PersonalityProfile['traits'][Trait]][]) {
    if (r.unsure) continue;
    const buckets: Bucket[] = r.blendWith ? [r.bucket, r.blendWith] : [r.bucket];
    let best: { edge: GrowthEdge; weight: number } | null = null;
    for (const [bi, bucket] of buckets.entries()) {
      const rows = [...BUCKET_GAPS[trait][bucket]].sort((x, y) => rank(x[3]) - rank(y[3]));
      const row = rows.find((x) => x[3] !== 'later' && signals[x[3]]);
      if (!row) continue;
      const push = pushOf(bucket);
      // own bucket wins ties over the blended neighbour
      const weight = PUSH_WEIGHT[push] * 10 - bi;
      if (!best || weight > best.weight) {
        best = { weight, edge: { trait, title: row[0], cause: row[1], action: row[2], evidence: signals[row[3]] as string, source: ACTIVITY_KEYS.includes(row[3]) ? 'activity' : 'test', bucket, push } };
      }
    }
    if (best) found.push({ edge: best.edge, weight: best.weight, extremity: Math.abs(r.score - 50) });
  }
  return found
    .sort((x, y) => y.weight - x.weight || y.extremity - x.extremity)
    .slice(0, 3)
    .map((x) => x.edge);
}
