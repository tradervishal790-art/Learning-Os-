// src/felderTest.ts
//
// Optional 12-question "how do you take in and work with new material" step (Felder-Silverman).
// 4 pairs x 3 two-choice questions, so each pair always has a winner (3-0 strong, 2-1 mild).
//   S/N  Sensing vs Intuitive     V/W  Visual vs Verbal
//   A/R  Active vs Reflective     Q/G  Sequential vs Global
// Local scoring, zero AI calls. A medium-weight supporting signal only.
export type FelderPole = 'S' | 'N' | 'V' | 'W' | 'A' | 'R' | 'Q' | 'G';
export type FelderPair = 'SN' | 'VW' | 'AR' | 'QG';

export interface FelderQuestion {
  id: string;
  pair: FelderPair;
  stem: string;
  options: [{ pole: FelderPole; text: string }, { pole: FelderPole; text: string }];
}
export interface FelderResult {
  picks: Record<FelderPair, { pole: FelderPole; strength: 'strong' | 'mild' }>;
  completedAt: string;
}

const Fq = (id: string, pair: FelderPair, stem: string, a: [FelderPole, string], b: [FelderPole, string]): FelderQuestion => ({
  id, pair, stem, options: [{ pole: a[0], text: a[1] }, { pole: b[0], text: b[1] }],
});

export const FELDER_QUESTIONS: FelderQuestion[] = [
  Fq('f1', 'SN', 'When learning something new, you prefer to start with:', ['S', 'Real examples and facts'], ['N', 'The big idea or the rule behind it']),
  Fq('f2', 'SN', 'You find it easier to:', ['S', 'Follow a method that has worked before'], ['N', 'Come up with a new way to do it']),
  Fq('f3', 'SN', 'In a test, you are better at:', ['S', 'Questions about facts and known methods'], ['N', 'Questions that need a new idea or a pattern']),
  Fq('f4', 'VW', 'You remember best:', ['V', 'What I saw: pictures, diagrams, charts'], ['W', 'What I heard or read: words and explanations']),
  Fq('f5', 'VW', 'When someone explains a route or a process, you prefer:', ['V', 'A diagram or a map'], ['W', 'Written or spoken steps']),
  Fq('f6', 'VW', 'In a lesson, you most want:', ['V', 'Charts, videos and diagrams'], ['W', 'A clear explanation in words']),
  Fq('f7', 'AR', 'To understand something new, you:', ['A', 'Try it out or discuss it'], ['R', 'Think it through quietly first']),
  Fq('f8', 'AR', 'In a group task, you usually:', ['A', 'Jump in and start'], ['R', 'Wait and think before speaking']),
  Fq('f9', 'AR', 'When you read a chapter, you:', ['A', 'Stop often to try the examples'], ['R', 'Read it through, then think about it afterwards']),
  Fq('f10', 'QG', 'When you study a topic, you:', ['Q', 'Go step by step, in order'], ['G', 'Jump around, and then it suddenly clicks']),
  Fq('f11', 'QG', 'When you are stuck, you:', ['Q', 'Go back to the missing step'], ['G', 'Step back to see the whole picture']),
  Fq('f12', 'QG', 'You solve a problem more easily by:', ['Q', 'Following logical steps one after another'], ['G', 'Seeing the answer first, then working out how']),
];

export function scoreFelder(answers: Record<string, FelderPole>): FelderResult {
  const picks = {} as FelderResult['picks'];
  for (const pair of ['SN', 'VW', 'AR', 'QG'] as FelderPair[]) {
    const first = pair[0] as FelderPole;
    const second = pair[1] as FelderPole;
    const qs = FELDER_QUESTIONS.filter((q) => q.pair === pair);
    const firstCount = qs.filter((q) => answers[q.id] === first).length;
    const secondCount = qs.length - firstCount;
    const pole = firstCount > secondCount ? first : second;
    const win = Math.max(firstCount, secondCount);
    picks[pair] = { pole, strength: win === qs.length ? 'strong' : 'mild' };
  }
  return { picks, completedAt: new Date().toISOString() };
}
