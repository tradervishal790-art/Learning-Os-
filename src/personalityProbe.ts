// src/personalityProbe.ts
//
// PART 2 of the Personality Check. Part 1 (20 questions) finds the first hint. Part 2 asks
// real-life situation questions ABOUT THE TRAITS THAT STOOD OUT (or looked unclear) in Part 1,
// so the result is cross-checked by a different kind of question. Static bank: zero AI calls.
// The AI is only used later, once, to write the final profile from BOTH parts.
//
// Each question has 4 options listed from the "low" end (score 1) to the "high" end (score 4);
// the quiz shuffles them on screen. Same trait axis as Part 1, so scores can be compared.
import { TRAITS, type Trait } from './personalityQuestions';
import { bucketOf, zoneOf, blendOf, type PersonalityProfile, type SecondTest, type TraitResult } from './personalityScoring';

export type Side = 'high' | 'low';
export interface ProbeQuestion {
  id: string;
  trait: Trait;
  side: Side; // which tendency this question probes (the side Part 1 pointed to)
  stem: string;
  options: [string, string, string, string]; // ascending: option i has score i + 1
}

const Q = (trait: Trait, side: Side, n: number, stem: string, options: ProbeQuestion['options']): ProbeQuestion => ({
  id: `q2_${trait}_${side}_${n}`, trait, side, stem, options,
});

export const PROBE_BANK: ProbeQuestion[] = [
  // ---- Openness ----
  Q('openness', 'high', 1, 'You find a really interesting side topic while studying for an exam in 3 days. You:', ['Ignore it completely; it is not in the syllabus', 'Note it down for later and carry on', 'Read a little, then go back to the syllabus', 'Follow it for an hour or more; it is too interesting']),
  Q('openness', 'high', 2, 'A question has no fixed method. You:', ['Ask for the method first', 'Try the usual method and hope it fits', 'Try two or three different ways', 'Invent my own way and enjoy testing it']),
  Q('openness', 'high', 3, 'You have to revise the same chapter a third time. You:', ['Feel fine; it is what works', 'Find it a bit boring but do it', 'Need a new way to do it or I lose interest', 'Avoid it; I would rather learn something new']),
  Q('openness', 'low', 1, 'A type of question you have never practised comes up. You:', ['Skip it and do what I know', 'Try it only after seeing a solved example', 'Give it a try and see', 'Love it; new types are the fun part']),
  Q('openness', 'low', 2, 'A friend suggests a study method that is new to you. You:', ['Stay with my own method', 'Try it only if it clearly saves time', 'Try it for one session', 'Try it right away']),
  Q('openness', 'low', 3, 'A topic looks useless for your exam, but a classmate finds it fascinating. You:', ['Skip it; not useful', 'Skim it quickly', 'Listen to why they like it', 'Read more about it myself']),
  // ---- Conscientiousness ----
  Q('conscientiousness', 'high', 1, 'Your study plan for the day is broken by an unexpected visitor. You:', ['Forget the plan and catch up whenever', 'Do a little when I can', 'Re-plan the rest of the day', 'Feel upset until the whole plan is back on track']),
  Q('conscientiousness', 'high', 2, 'You finished a chapter and understand about 80% of it. You:', ['Move on; it is enough', 'Move on but mark it for later', 'Revise once more, then move on', 'Stay on it until I am sure of 100%']),
  Q('conscientiousness', 'high', 3, 'A mock test is near. Your notes are perfect but you have practised few questions. You:', ['Not worry; I will manage', 'Practise a few if there is time', 'Plan time for practice', 'Spend more time making the notes and timetable even better first']),
  Q('conscientiousness', 'low', 1, 'A big assignment is due in 10 days. When do you really start?', ['The last 1 or 2 days', 'About 4 days before', 'A few days after getting it', 'The same day, in small parts']),
  Q('conscientiousness', 'low', 2, 'It is study time but you do not feel like it. You:', ['Wait until I feel like it', 'Do something else first, then maybe', 'Start with one very small task', 'Start at the planned time anyway']),
  Q('conscientiousness', 'low', 3, 'You missed your study plan for 2 days. You:', ['Drop the plan and maybe start something new later', 'Feel bad and avoid it for a while', 'Restart in a day or two', 'Restart the next day exactly where I left off']),
  // ---- Extraversion ----
  Q('extraversion', 'high', 1, 'Where do you learn a hard topic best?', ['Alone, in silence', 'Alone, then check with one person', 'With one or two friends', 'In a lively group where we talk it out']),
  Q('extraversion', 'high', 2, 'You have 3 hours alone to study, with no friends or phone. You:', ['Enjoy it; it is my best time', 'Are fine and get a lot done', 'Get restless after an hour', 'Struggle; I need someone around']),
  Q('extraversion', 'high', 3, 'After a long group study session, you:', ['Feel drained and need quiet', 'Feel okay', 'Feel energised', 'Want to keep going and talk more']),
  Q('extraversion', 'low', 1, 'You are stuck on a doubt. You:', ['Struggle alone for hours', 'Wait a day before asking anyone', 'Ask a friend or teacher soon', 'Ask right away; talking helps me think']),
  Q('extraversion', 'low', 2, 'Your teacher asks a question and you think you know the answer. You:', ['Stay silent', 'Answer only if asked directly', 'Raise my hand if I am sure', 'Answer quickly, even if unsure']),
  Q('extraversion', 'low', 3, 'You must explain a topic aloud to a group tomorrow. You:', ['Dread it', 'Write everything out first', 'Practise with one person', 'Look forward to it']),
  // ---- Agreeableness ----
  Q('agreeableness', 'high', 1, 'A friend asks for help just before your exam. You:', ['Say sorry; I need my time', 'Help for a few minutes only', 'Help for a while, then study', 'Help fully, even if my own study suffers']),
  Q('agreeableness', 'high', 2, 'A confident classmate gives an answer you think is wrong. You:', ['Say so clearly', 'Check it, then say so politely', 'Mention a small doubt', 'Stay quiet to avoid an argument']),
  Q('agreeableness', 'high', 3, 'Your group wants to use a method you think is slower. You:', ['Use my own method', 'Argue for mine, then follow', 'Suggest mine but go along', 'Go along without saying anything']),
  Q('agreeableness', 'low', 1, 'Your teacher corrects your answer in front of others. You:', ['Feel attacked and argue', 'Disagree inside but stay quiet', 'Accept it and fix it', 'Thank them; it is helpful']),
  Q('agreeableness', 'low', 2, 'You get a group assignment. You:', ['Prefer to do it all alone', 'Take the hardest part alone', 'Share the tasks equally', 'Gladly take whatever the group needs']),
  Q('agreeableness', 'low', 3, 'A classmate solves a problem differently from you. You:', ['Mine is better; ignore theirs', 'Listen but keep mine', 'Try theirs once', 'Happily adopt it if it is good']),
  // ---- Neuroticism (pressure sensitivity) ----
  Q('neuroticism', 'high', 1, 'The night before an exam, you:', ['Sleep normally', 'Feel a little nervous but fine', 'Keep going over what could go wrong', 'Cannot sleep; my mind keeps racing']),
  Q('neuroticism', 'high', 2, 'You get a low score on a test you worked hard for. You:', ['Shrug and move on', 'Feel bad for a few hours', 'Feel low for a day or two and doubt myself', 'Feel it means I am just not good at this']),
  Q('neuroticism', 'high', 3, 'A classmate scores higher than you. You:', ['Do not think about it', 'Notice it briefly', 'Feel behind for a while', 'Feel upset and stressed about it']),
  Q('neuroticism', 'low', 1, 'You score 70% and the class average is 65%. You:', ['Relax; I am sure I am fine', 'Feel a little relaxed, then check', 'Look at what I missed', 'Still worry I could have done better']),
  Q('neuroticism', 'low', 2, 'Your marks drop for the second test in a row. You:', ['Do not worry; it will be fine', 'Notice it but wait', 'Look into why', 'Feel worried and look into it at once']),
  Q('neuroticism', 'low', 3, 'In a test with time left, before submitting you:', ['Submit; I am sure it is right', 'Check only the hard ones', 'Check most answers', 'Check everything twice']),
];

/** The 3 traits to probe: unclear ones first, then the ones that stood out most. */
export function pickProbeTraits(p: PersonalityProfile): Trait[] {
  return [...TRAITS]
    .sort((a, b) => {
      const ua = p.traits[a].unsure ? 1 : 0;
      const ub = p.traits[b].unsure ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return Math.abs(p.traits[b].score - 50) - Math.abs(p.traits[a].score - 50);
    })
    .slice(0, 3);
}

/** 3 questions per probed trait, on the side Part 1 pointed to (50 and above = "high" side). */
export function pickProbeQuestions(p: PersonalityProfile): ProbeQuestion[] {
  const picked = pickProbeTraits(p).map((t) => {
    const side: Side = p.traits[t].score >= 50 ? 'high' : 'low';
    return PROBE_BANK.filter((q) => q.trait === t && q.side === side);
  });
  // interleave so the same trait does not come 3 times in a row
  const out: ProbeQuestion[] = [];
  for (let i = 0; i < 3; i++) for (const group of picked) if (group[i]) out.push(group[i]);
  return out;
}

const MIXED_GAP = 25; // points apart = the two parts disagree

/** Part 2 scores + the cross-check. Part 2 answers are {questionId: score 1-4}. */
export function applySecondTest(profile: PersonalityProfile, questions: ProbeQuestion[], answers: Record<string, number>): PersonalityProfile {
  const probed = [...new Set(questions.map((q) => q.trait))];
  const part1: Partial<Record<Trait, number>> = {};
  const part2: Partial<Record<Trait, number>> = {};
  const agreement: Partial<Record<Trait, 'agree' | 'mixed'>> = {};
  const traits = { ...profile.traits };

  for (const t of probed) {
    const qs = questions.filter((q) => q.trait === t);
    const sum = qs.reduce((s, q) => s + (answers[q.id] ?? 0), 0);
    const s2 = Math.round(((sum - qs.length) / (qs.length * 3)) * 100);
    const s1 = profile.traits[t].score;
    const mixed = Math.abs(s1 - s2) > MIXED_GAP;
    const final = Math.round((s1 + s2) / 2);
    const bucket = bucketOf(final);
    part1[t] = s1;
    part2[t] = s2;
    agreement[t] = mixed ? 'mixed' : 'agree';
    const result: TraitResult = {
      score: final,
      bucket,
      blendWith: blendOf(final, bucket),
      zone: mixed ? 'middle' : zoneOf(final),
      unsure: mixed, // Part 2 settles an unclear Part 1 when they agree; disagreement stays unclear
    };
    traits[t] = result;
  }

  const second: SecondTest = {
    completedAt: new Date().toISOString(),
    probedTraits: probed,
    answers,
    part1: part1 as Record<string, number>,
    part2: part2 as Record<string, number>,
    agreement: agreement as Record<string, 'agree' | 'mixed'>,
  };
  const unsureCount = TRAITS.filter((t) => traits[t].unsure).length;
  return { ...profile, traits, second, report: undefined, retakeSuggested: unsureCount >= 3 };
}
