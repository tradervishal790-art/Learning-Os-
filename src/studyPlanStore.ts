// ============================================================
// studyPlanStore.ts — "My Files" daily plan.
//
// The learner adds their own photos/PDFs; each becomes a topic (T1, T2, ...).
// Rules (decided with Vishal):
//  - 1 new topic per day per subject (max 2 subjects in parallel).
//  - Each learned topic is revised on Day +1, +3, +7, +15 after the day it was learned.
//  - Missed revisions become Overdue and are shown first. Nothing is skipped.
//  - A missed new topic simply stays as the next new topic (no skipping).
//  - Long PDFs can optionally be split into 2-5 parts; each part is its own topic.
//  - Metadata lives in localStorage; the files themselves live in IndexedDB
//    (studyFiles.ts). No AI, no cloud — this device only.
// ============================================================

export const CHECKPOINTS = [1, 3, 7, 15] as const;
export const MAX_SUBJECTS = 2;

const KEY = 'learning_os_study_plan';

export interface StudyTopic {
  id: string;
  subject: string;
  /** Position inside its subject, 1-based -> shown as T1, T2, ... */
  number: number;
  title: string;
  kind: 'pdf' | 'images';
  /** IndexedDB keys of the stored file(s) (1 for a PDF, 1+ for photos). */
  fileKeys: string[];
  /** Local date (YYYY-MM-DD) the learner marked it learned, or null if not learned yet. */
  learnedOn: string | null;
  /** Checkpoint days (subset of CHECKPOINTS) already revised. */
  reviewed: number[];
}

export interface StudyPlanState {
  version: 1;
  subjects: string[];
  topics: StudyTopic[];
}

export type RevisionState = 'overdue' | 'due-today';

export interface RevisionTask {
  topic: StudyTopic;
  day: number;
  dueDate: string;
  state: RevisionState;
  daysLate: number;
}

const empty = (): StudyPlanState => ({ version: 1, subjects: [], topics: [] });

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

export function loadPlan(): StudyPlanState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.topics) && Array.isArray(p.subjects)) return { ...empty(), ...p };
  } catch {
    // fall through
  }
  return empty();
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

export function newId(): string {
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Adds topics (already stored in IndexedDB) to a subject; creates the subject if it's new. */
export function addTopics(
  state: StudyPlanState,
  subject: string,
  items: { title: string; kind: 'pdf' | 'images'; fileKeys: string[] }[]
): StudyPlanState {
  const subjects = state.subjects.includes(subject) ? state.subjects : [...state.subjects, subject];
  let n = state.topics.filter((t) => t.subject === subject).reduce((m, t) => Math.max(m, t.number), 0);
  const added: StudyTopic[] = items.map((it) => ({
    id: newId(),
    subject,
    number: ++n,
    title: it.title,
    kind: it.kind,
    fileKeys: it.fileKeys,
    learnedOn: null,
    reviewed: [],
  }));
  return { ...state, subjects, topics: [...state.topics, ...added] };
}

export function removeTopic(state: StudyPlanState, id: string): StudyPlanState {
  const topics = state.topics.filter((t) => t.id !== id);
  const subjects = state.subjects.filter((s) => topics.some((t) => t.subject === s));
  return { ...state, topics, subjects };
}

export function markLearned(state: StudyPlanState, id: string, today = todayKey()): StudyPlanState {
  return { ...state, topics: state.topics.map((t) => (t.id === id && !t.learnedOn ? { ...t, learnedOn: today } : t)) };
}

export function markReviewed(state: StudyPlanState, id: string, day: number): StudyPlanState {
  return {
    ...state,
    topics: state.topics.map((t) =>
      t.id === id && !t.reviewed.includes(day) ? { ...t, reviewed: [...t.reviewed, day].sort((a, b) => a - b) } : t
    ),
  };
}

export function isMastered(t: StudyTopic): boolean {
  return !!t.learnedOn && CHECKPOINTS.every((d) => t.reviewed.includes(d));
}

export interface TodayView {
  /** One per subject: the next topic not learned yet (none if that subject's new topic was already done today). */
  newTopics: StudyTopic[];
  /** New topics already finished today. */
  doneToday: StudyTopic[];
  /** Overdue first (oldest first), then due today. */
  revisions: RevisionTask[];
  /** Next few revisions coming up (not due yet). */
  upcoming: { topic: StudyTopic; day: number; dueDate: string }[];
  masteredCount: number;
}

export function buildToday(state: StudyPlanState, today = todayKey()): TodayView {
  const newTopics: StudyTopic[] = [];
  const doneToday: StudyTopic[] = [];
  for (const subject of state.subjects) {
    const mine = state.topics.filter((t) => t.subject === subject).sort((a, b) => a.number - b.number);
    const learnedToday = mine.filter((t) => t.learnedOn === today);
    doneToday.push(...learnedToday);
    if (learnedToday.length === 0) {
      const next = mine.find((t) => !t.learnedOn);
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
      else if (late === 0) revisions.push({ topic: t, day, dueDate, state: 'due-today', daysLate: 0 });
      else upcoming.push({ topic: t, day, dueDate });
    }
  }
  revisions.sort((a, b) => b.daysLate - a.daysLate || a.topic.number - b.topic.number);
  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return { newTopics, doneToday, revisions, upcoming, masteredCount: state.topics.filter(isMastered).length };
}
