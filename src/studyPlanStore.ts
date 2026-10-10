// ============================================================
// studyPlanStore.ts — "My files" daily plan, built from boxes (T1, T2, ...).
//
// Rules (decided with Vishal):
//  - The learner adds a box (T1, T2, ...) and puts any photos/PDFs inside it.
//  - 1 new topic per day per subject (max 2 subjects in parallel).
//  - A learned box is revised on Day +1, +3, +7, +15 after the day it was learned.
//  - Missed revisions become Overdue and are shown first. Nothing is skipped.
//  - When the last revision (Day +15) is done, the box and its files are cleared
//    automatically and its number (e.g. T1) becomes free for the next new box.
//  - A long PDF can optionally be split into 2-5 parts (each part gets its own box).
//  - Metadata lives in localStorage; the files live in IndexedDB (studyFiles.ts).
//    No AI, no cloud — this device only.
// ============================================================

export const CHECKPOINTS = [1, 3, 7, 15] as const;
export const MAX_SUBJECTS = 2;
export const MAX_BOXES = 30;

const KEY = 'learning_os_study_plan';

export interface StudyFile {
  key: string; // IndexedDB key
  name: string;
  kind: 'pdf' | 'image';
}

export interface StudyTopic {
  id: string;
  subject: string;
  /** Box number shown to the learner (T1, T2, ...). Reused after a box is cleared. */
  number: number;
  /** Creation order — decides which box is the next "new topic" (numbers get reused, this doesn't). */
  seq: number;
  files: StudyFile[];
  /** Local date (YYYY-MM-DD) the learner marked it learned, or null. */
  learnedOn: string | null;
  /** Checkpoint days already revised. */
  reviewed: number[];
}

export interface StudyPlanState {
  version: 2;
  subjects: string[];
  topics: StudyTopic[];
  nextSeq: number;
  /** Boxes that finished the full cycle and were cleared. */
  completed: number;
}

export type RevisionState = 'overdue' | 'due-today';

export interface RevisionTask {
  topic: StudyTopic;
  day: number;
  dueDate: string;
  state: RevisionState;
  daysLate: number;
}

const empty = (): StudyPlanState => ({ version: 2, subjects: [], topics: [], nextSeq: 1, completed: 0 });

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / 86400000);
}

export function newId(): string {
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadPlan(): StudyPlanState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.topics) || !Array.isArray(p.subjects)) return empty();
    if (p.version === 2) return { ...empty(), ...p };
    // v1 (one topic per file) -> v2 (boxes with files)
    const topics: StudyTopic[] = p.topics.map((t: any, i: number) => ({
      id: t.id,
      subject: t.subject,
      number: t.number,
      seq: i + 1,
      files: (t.fileKeys ?? []).map((key: string, j: number) => ({
        key,
        name: t.title ? (j === 0 ? t.title : `${t.title} ${j + 1}`) : `File ${j + 1}`,
        kind: t.kind === 'pdf' ? 'pdf' : 'image',
      })),
      learnedOn: t.learnedOn ?? null,
      reviewed: t.reviewed ?? [],
    }));
    return { ...empty(), subjects: p.subjects, topics, nextSeq: topics.length + 1 };
  } catch {
    return empty();
  }
}

/** Returns false if the browser refused to store it (storage full). */
export function savePlan(s: StudyPlanState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function addSubject(state: StudyPlanState, name: string): StudyPlanState {
  if (state.subjects.includes(name) || state.subjects.length >= MAX_SUBJECTS) return state;
  return { ...state, subjects: [...state.subjects, name] };
}

/** Smallest box number not currently used in this subject — so a cleared T1 is reused. */
export function nextFreeNumber(state: StudyPlanState, subject: string): number {
  const used = new Set(state.topics.filter((t) => t.subject === subject).map((t) => t.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export function addBox(state: StudyPlanState, subject: string, files: StudyFile[] = []): StudyPlanState {
  if (state.topics.length >= MAX_BOXES) return state;
  const box: StudyTopic = {
    id: newId(),
    subject,
    number: nextFreeNumber(state, subject),
    seq: state.nextSeq,
    files,
    learnedOn: null,
    reviewed: [],
  };
  return { ...state, topics: [...state.topics, box], nextSeq: state.nextSeq + 1 };
}

export function addFilesToBox(state: StudyPlanState, id: string, files: StudyFile[]): StudyPlanState {
  return { ...state, topics: state.topics.map((t) => (t.id === id ? { ...t, files: [...t.files, ...files] } : t)) };
}

export function removeFileFromBox(state: StudyPlanState, id: string, key: string): StudyPlanState {
  return { ...state, topics: state.topics.map((t) => (t.id === id ? { ...t, files: t.files.filter((f) => f.key !== key) } : t)) };
}

/** Replaces one file in a box with several (used when splitting a PDF); returns the new state. */
export function replaceFiles(state: StudyPlanState, id: string, files: StudyFile[]): StudyPlanState {
  return { ...state, topics: state.topics.map((t) => (t.id === id ? { ...t, files } : t)) };
}

export function removeBox(state: StudyPlanState, id: string): StudyPlanState {
  return { ...state, topics: state.topics.filter((t) => t.id !== id) };
}

export function markLearned(state: StudyPlanState, id: string, today = todayKey()): StudyPlanState {
  return {
    ...state,
    topics: state.topics.map((t) => (t.id === id && !t.learnedOn && t.files.length > 0 ? { ...t, learnedOn: today } : t)),
  };
}

/** Marks a checkpoint done. If it was the last one, the box is cleared and returned as `expired`. */
export function markReviewed(
  state: StudyPlanState,
  id: string,
  day: number
): { state: StudyPlanState; expired: StudyTopic | null } {
  const topic = state.topics.find((t) => t.id === id);
  if (!topic || topic.reviewed.includes(day)) return { state, expired: null };
  const updated: StudyTopic = { ...topic, reviewed: [...topic.reviewed, day].sort((a, b) => a - b) };
  const finished = CHECKPOINTS.every((d) => updated.reviewed.includes(d));
  if (finished) {
    return {
      state: { ...state, topics: state.topics.filter((t) => t.id !== id), completed: state.completed + 1 },
      expired: updated,
    };
  }
  return { state: { ...state, topics: state.topics.map((t) => (t.id === id ? updated : t)) }, expired: null };
}

export interface TodayView {
  /** Per subject: the next box (by creation order) that has files and isn't learned yet — none if one was already learned today. */
  newTopics: StudyTopic[];
  doneToday: StudyTopic[];
  /** Overdue first (most late first), then due today. */
  revisions: RevisionTask[];
  upcoming: { topic: StudyTopic; day: number; dueDate: string }[];
}

export function buildToday(state: StudyPlanState, today = todayKey()): TodayView {
  const newTopics: StudyTopic[] = [];
  const doneToday: StudyTopic[] = [];
  for (const subject of state.subjects) {
    const mine = state.topics.filter((t) => t.subject === subject).sort((a, b) => a.seq - b.seq);
    const learnedToday = mine.filter((t) => t.learnedOn === today);
    doneToday.push(...learnedToday);
    if (learnedToday.length === 0) {
      const next = mine.find((t) => !t.learnedOn && t.files.length > 0);
      if (next) newTopics.push(next);
    }
  }

  const revisions: RevisionTask[] = [];
  const upcoming: TodayView['upcoming'] = [];
  for (const t of state.topics) {
    if (!t.learnedOn) continue;
    for (const day of CHECKPOINTS) {
      if (t.reviewed.includes(day)) continue;
      const dueDate = addDays(t.learnedOn, day);
      const late = daysBetween(dueDate, today);
      if (late > 0) revisions.push({ topic: t, day, dueDate, state: 'overdue', daysLate: late });
      else if (late === 0) revisions.push({ topic: t, day, dueDate, state: 'due-today' as const, daysLate: 0 });
      else upcoming.push({ topic: t, day, dueDate });
    }
  }
  revisions.sort((a, b) => b.daysLate - a.daysLate || a.topic.seq - b.topic.seq);
  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { newTopics, doneToday, revisions, upcoming };
}
