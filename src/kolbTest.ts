// src/kolbTest.ts
//
// Optional 8-question "how do you approach new problems" step (Kolb). Each option points to one of
// four modes: CE (feel / experience), RO (watch / reflect), AC (think / theory), AE (do / try).
//   grasping axis    = AC minus CE   (+ = thinking, - = experiencing)
//   transforming axis = AE minus RO  (+ = doing,    - = reflecting)
//   AC+RO Assimilating, AC+AE Converging, CE+RO Diverging, CE+AE Accommodating.
// A tie on an axis keeps both sides (several types). Local scoring, zero AI calls.
export type KolbMode = 'CE' | 'RO' | 'AC' | 'AE';
export type KolbType = 'Diverging' | 'Assimilating' | 'Converging' | 'Accommodating';

export interface KolbQuestion {
  id: string;
  stem: string;
  options: Record<KolbMode, string>;
}
export interface KolbResult {
  counts: Record<KolbMode, number>;
  types: KolbType[]; // usually 1; 2-4 when an axis was a tie
  completedAt: string;
}

export const KOLB_QUESTIONS: KolbQuestion[] = [
  { id: 'k1', stem: 'When you face a new problem, you first:', options: { CE: 'Recall a similar experience and how it felt', RO: 'Watch and listen before acting', AC: 'Work out the logic and a model', AE: 'Try something quickly and see' } },
  { id: 'k2', stem: 'You learn best when you:', options: { CE: 'Get real, personal experiences', RO: 'Have time to think things over', AC: 'Understand the theory behind it', AE: 'Get to try it out and practise' } },
  { id: 'k3', stem: 'When a new idea is introduced, you:', options: { CE: 'Connect it with people and real cases', RO: 'Look at it from several angles first', AC: 'Check that it is logical and well-defined', AE: 'Look for how to use it right now' } },
  { id: 'k4', stem: 'In group work, you usually:', options: { CE: 'Pay attention to people\'s feelings and ideas', RO: 'Observe quietly, then contribute', AC: 'Analyse and structure the problem', AE: 'Take charge and get things moving' } },
  { id: 'k5', stem: 'A good lesson for you is one that:', options: { CE: 'Is personal and has real stories', RO: 'Gives time to reflect and discuss meaning', AC: 'Explains concepts and models clearly', AE: 'Has hands-on tasks and projects' } },
  { id: 'k6', stem: 'When you make a mistake, you:', options: { CE: 'Think about how it felt and who it affected', RO: 'Replay it in my head to understand it', AC: 'Look for the rule or reason that explains it', AE: 'Fix it and try again straight away' } },
  { id: 'k7', stem: 'Before a decision, you rely most on:', options: { CE: 'My gut feeling and past experience', RO: 'Careful observation of what is happening', AC: 'Logic, facts and analysis', AE: 'Testing it in practice' } },
  { id: 'k8', stem: 'Your ideal way to prepare for a test is:', options: { CE: 'Study with real examples and a friend', RO: 'Read and think it through quietly', AC: 'Build a clear structure of concepts and formulas', AE: 'Do lots of practice questions' } },
];

export function scoreKolb(answers: Record<string, KolbMode>): KolbResult {
  const counts: Record<KolbMode, number> = { CE: 0, RO: 0, AC: 0, AE: 0 };
  for (const m of Object.values(answers)) counts[m]++;
  const grasp = counts.AC - counts.CE;
  const transform = counts.AE - counts.RO;
  const g = grasp > 0 ? ['AC'] : grasp < 0 ? ['CE'] : ['AC', 'CE'];
  const t = transform > 0 ? ['AE'] : transform < 0 ? ['RO'] : ['AE', 'RO'];
  const NAME: Record<string, KolbType> = { 'AC+RO': 'Assimilating', 'AC+AE': 'Converging', 'CE+RO': 'Diverging', 'CE+AE': 'Accommodating' };
  const types = g.flatMap((a) => t.map((b) => NAME[`${a}+${b}`]));
  return { counts, types, completedAt: new Date().toISOString() };
}
