// src/growthEdges.ts
//
// "Growth edges" = personality tendency (Personality Check zone) CONFIRMED by
// real test behaviour. Rules (from the Growth Gaps doc):
//   - Trait predicts, behaviour confirms: an edge needs BOTH a lower/higher
//     zone AND a matching signal in the learner's tests. Middle zone or an
//     "unsure" trait never produces an edge (behaviour data leads there).
//   - One edge per trait, at most 3 shown, strongest trait extremes first.
//   - Gentle wording ("growth edge"), honest numbers in the evidence line.
// Pure, on-device, no AI.
import type { AttemptStats, HistoryStats } from './testAnalytics';
import type { PersonalityProfile } from './personalityScoring';
import type { Trait } from './personalityQuestions';

export interface GrowthEdge {
  trait: Trait;
  title: string; // what goes wrong
  cause: string; // why it happens
  action: string; // what to try next
  evidence: string; // the real numbers from their tests
}

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

interface Rule {
  trait: Trait;
  zone: 'lower' | 'higher';
  signal: keyof Signals;
  title: string;
  cause: string;
  action: string;
}

// Priority order inside each (trait, zone): first matching signal wins.
const RULES: Rule[] = [
  // Openness
  { trait: 'openness', zone: 'higher', signal: 'lowAccuracy', title: 'Weak at the boring basics', cause: 'Formulas and drills can feel beneath you, so basics get skipped.', action: 'Do a short basics drill as a puzzle before your next test, and note which basics cost you marks.' },
  { trait: 'openness', zone: 'higher', signal: 'repeatedMiss', title: 'Revision gets skipped', cause: 'Repeated material feels dull, so it is avoided and then forgotten.', action: 'Revise the questions you keep missing with a small twist: explain each one in a new way.' },
  { trait: 'openness', zone: 'lower', signal: 'sticky', title: 'Copying the method without the idea', cause: 'Following a fixed routine feels safe, so the reason behind it is missed.', action: 'After each solved example, try the same idea in a new situation.' },
  { trait: 'openness', zone: 'lower', signal: 'blank', title: 'Freezing on unfamiliar questions', cause: 'New feels uncertain, so it feels risky to try.', action: 'Practise one new question format at a time, in low-stakes sets.' },
  // Conscientiousness
  { trait: 'conscientiousness', zone: 'higher', signal: 'plateau', title: 'A neat plan feels like progress', cause: 'A tidy timetable gives a sense of control without testing what you recall.', action: 'Judge your week by recall and accuracy, not by hours or ticks.' },
  { trait: 'conscientiousness', zone: 'higher', signal: 'lateBlank', title: 'Waiting for 100% before moving on', cause: 'Fear of leaving gaps keeps you on early questions too long.', action: 'Use an 80% rule: move on once you are mostly sure, and return later.' },
  { trait: 'conscientiousness', zone: 'lower', signal: 'repeatedMiss', title: 'No review system', cause: 'You learn a topic once and rarely return to it.', action: 'Put the missed questions into your Revision schedule so they come back on their own.' },
  { trait: 'conscientiousness', zone: 'lower', signal: 'lateBlank', title: 'Underestimating the time', cause: 'Optimistic planning: the paper takes longer than expected.', action: 'Time yourself per question in practice and plan the paper by the clock.' },
  { trait: 'conscientiousness', zone: 'lower', signal: 'declining', title: 'Strong start, weak middle', cause: 'Novelty fades and there is no routine to carry you.', action: 'Set one small daily task so a low day still counts.' },
  // Extraversion
  { trait: 'extraversion', zone: 'lower', signal: 'sticky', title: 'A wrong idea stays hidden', cause: 'With no one to correct you, a misunderstanding keeps repeating.', action: 'Explain the missed concept in your own words to the Mentor and let it correct you.' },
  { trait: 'extraversion', zone: 'lower', signal: 'repeatedMiss', title: 'Doubts stay unasked', cause: 'Asking feels like extra effort, so small gaps grow.', action: 'Ask the Mentor about every repeated mistake before the next test.' },
  { trait: 'extraversion', zone: 'higher', signal: 'lowAccuracy', title: 'Weaker in silent, solo conditions', cause: 'Silent solo practice is the condition you practise least.', action: 'Do one silent, timed practice set before your next test.' },
  { trait: 'extraversion', zone: 'higher', signal: 'repeatedMiss', title: 'Talking feels like knowing', cause: 'Discussion gives a feeling of clarity without checking recall.', action: 'After any group study, take a short solo written quiz.' },
  // Agreeableness
  { trait: 'agreeableness', zone: 'lower', signal: 'sticky', title: 'Correction feels like criticism', cause: 'A correction can feel like an attack, so the old answer stays.', action: 'Look at your repeated mistakes as a pattern in the data, not as a verdict.' },
  { trait: 'agreeableness', zone: 'higher', signal: 'weakTopics', title: 'Your own weak areas stay untouched', cause: 'Helping others feels productive, so your own practice slips.', action: 'Block your own practice on the weak topics before helping anyone.' },
  // Pressure sensitivity (neuroticism)
  { trait: 'neuroticism', zone: 'lower', signal: 'careless', title: 'Careless mistakes', cause: 'Feeling sure, so the final check gets skipped.', action: 'Add a 2-minute check before you submit, and skip answers you are unsure about.' },
  { trait: 'neuroticism', zone: 'lower', signal: 'overAttempt', title: 'Confidence ahead of accuracy', cause: 'Feeling calm can feel like being ready.', action: 'Compare how sure you felt with how many you got right.' },
  { trait: 'neuroticism', zone: 'lower', signal: 'declining', title: 'Falling scores do not alarm you', cause: 'A drop does not feel urgent, so it goes unchecked.', action: 'Treat three drops in a row as a signal to change something.' },
  { trait: 'neuroticism', zone: 'higher', signal: 'blank', title: 'Blanking under pressure', cause: 'Worry uses up working memory, so known answers slip away.', action: 'Take a short calm pause before the test and practise timed, low-stakes sets.' },
  { trait: 'neuroticism', zone: 'higher', signal: 'scoreDrop', title: 'One bad score feels like proof', cause: 'A score is read as a verdict on you, not as feedback.', action: 'Look at the trend across tests, not a single score.' },
  { trait: 'neuroticism', zone: 'higher', signal: 'weakTopics', title: 'Hard chapters get delayed', cause: 'Difficulty triggers stress, so the topic is pushed back.', action: 'Split the weak topic into small steps and start it early in the week.' },
];

export function computeGrowthEdges(profile: PersonalityProfile | null, a: AttemptStats, h: HistoryStats): GrowthEdge[] {
  if (!profile) return [];
  const signals = deriveSignals(a, h);
  const found: { edge: GrowthEdge; extremity: number }[] = [];

  for (const [trait, r] of Object.entries(profile.traits) as [Trait, PersonalityProfile['traits'][Trait]][]) {
    if (r.unsure || r.zone === 'middle') continue;
    const rule = RULES.find((x) => x.trait === trait && x.zone === r.zone && signals[x.signal]);
    if (!rule) continue;
    found.push({
      edge: { trait, title: rule.title, cause: rule.cause, action: rule.action, evidence: signals[rule.signal] as string },
      extremity: Math.abs(r.score - 50),
    });
  }
  return found.sort((x, y) => y.extremity - x.extremity).slice(0, 3).map((x) => x.edge);
}
