// src/varkTest.ts
//
// Optional 8-question "how do you like to learn" step (VARK). The Big Five cannot tell this,
// so it has its own tiny test. Every question has 4 options, one per style. Local scoring,
// zero AI calls. It only says how a learner likes CONTENT; it is a supporting signal.
export type VarkKey = 'V' | 'A' | 'R' | 'K';
export const VARK_LABELS: Record<VarkKey, string> = { V: 'Visual', A: 'Auditory', R: 'Read/Write', K: 'Kinesthetic' };

export interface VarkQuestion {
  id: string;
  stem: string;
  options: Record<VarkKey, string>;
}

export interface VarkResult {
  counts: Record<VarkKey, number>;
  top: VarkKey[]; // strongest style(s); several = a mix
  completedAt: string;
}

export const VARK_QUESTIONS: VarkQuestion[] = [
  { id: 'v1', stem: 'To learn how a new app or tool works, you prefer to:', options: { V: 'Watch a video or look at screenshots', A: 'Have someone explain it to me', R: 'Read the instructions or help page', K: 'Just start using it and figure it out' } },
  { id: 'v2', stem: 'To remember a hard topic for an exam, you:', options: { V: 'Draw diagrams or colour-code', A: 'Say it aloud or discuss it', R: 'Write and re-read notes or lists', K: 'Practise problems or use real examples' } },
  { id: 'v3', stem: 'In class you learn the most when the teacher:', options: { V: 'Uses pictures, graphs and diagrams', A: 'Explains and discusses clearly', R: 'Gives handouts or notes to copy', K: 'Gives a demo or lets us try it' } },
  { id: 'v4', stem: 'When you get stuck on a doubt, you first:', options: { V: 'Look for a picture, video or diagram', A: 'Ask someone to explain it', R: 'Look it up in a book or online and read', K: 'Try different things until it works' } },
  { id: 'v5', stem: 'Going somewhere new, you prefer:', options: { V: 'A map', A: 'Someone telling me the directions', R: 'Written directions', K: 'Just going and finding the way' } },
  { id: 'v6', stem: 'Which study help do you enjoy most?', options: { V: 'Mind maps and infographics', A: 'Podcasts, voice notes, group discussion', R: 'Articles, books and written summaries', K: 'Experiments, labs or hands-on projects' } },
  { id: 'v7', stem: 'When you explain something to a friend, you:', options: { V: 'Draw it', A: 'Talk it through', R: 'Write the steps', K: 'Show it or act it out' } },
  { id: 'v8', stem: 'After a lesson, what feels like real proof you understood?', options: { V: 'I can picture the diagram', A: 'I can explain it aloud', R: 'I can write a clear summary', K: 'I can solve or build something with it' } },
];

export function scoreVark(answers: Record<string, VarkKey>): VarkResult {
  const counts: Record<VarkKey, number> = { V: 0, A: 0, R: 0, K: 0 };
  for (const k of Object.values(answers)) counts[k]++;
  const max = Math.max(...Object.values(counts));
  // a clear favourite is a style with the top count; a flat result (top count 2 or less) is a mix
  const keys = (Object.keys(counts) as VarkKey[]);
  const top = max <= 2 ? keys.filter((k) => counts[k] >= 2) : keys.filter((k) => counts[k] === max);
  return { counts, top, completedAt: new Date().toISOString() };
}
