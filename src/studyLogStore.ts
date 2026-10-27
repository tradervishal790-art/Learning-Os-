import { pullFromCloud, pushToCloud } from './cloudSync';

/**
 * Daily study log — local-first, with best-effort per-user cloud sync.
 * Stores completed study sessions independently from roadmap completion.
 */

const STORAGE_KEY = 'learning_os_study_log';
const CLOUD_KEY = 'studyLog';
const VERSION = 1;

export interface StudyLogEntry {
  id: string;
  date: string; // Local calendar date, YYYY-MM-DD
  subject: string;
  topic: string;
  minutes: number;
  /** Optional self-reported recall score, 0–100. Not an AI-estimated retention value. */
  recallScore?: number;
  createdAt: string;
}

export interface StudyLogState {
  version: 1;
  entries: StudyLogEntry[];
}

export interface StudyLogSummary {
  totalSessions: number;
  totalMinutes: number;
  minutesToday: number;
  sessionsToday: number;
  activeDays: number;
  averageRecall: number | null;
}

const emptyState = (): StudyLogState => ({ version: VERSION, entries: [] });

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function validEntry(value: unknown): value is StudyLogEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<StudyLogEntry>;
  return typeof e.id === 'string'
    && e.id.trim().length > 0
    && isValidDateKey(e.date)
    && typeof e.subject === 'string'
    && e.subject.trim().length > 0
    && typeof e.topic === 'string'
    && e.topic.trim().length > 0
    && typeof e.minutes === 'number'
    && Number.isSafeInteger(e.minutes)
    && e.minutes > 0
    && typeof e.createdAt === 'string'
    && e.createdAt.trim().length > 0
    && !Number.isNaN(Date.parse(e.createdAt))
    && (e.recallScore === undefined || (typeof e.recallScore === 'number' && Number.isFinite(e.recallScore) && e.recallScore >= 0 && e.recallScore <= 100));
}

function normalize(value: unknown): StudyLogState {
  if (!value || typeof value !== 'object') return emptyState();
  const raw = value as Partial<StudyLogState>;
  if (!Array.isArray(raw.entries)) return emptyState();
  const unique = new Map<string, StudyLogEntry>();
  for (const entry of raw.entries) {
    if (validEntry(entry)) unique.set(entry.id, entry);
  }
  return { version: VERSION, entries: [...unique.values()].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)) };
}

export function loadStudyLog(): StudyLogState {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

/** Returns false if local storage is unavailable or full. */
export function saveStudyLog(state: StudyLogState): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    void pushToCloud(CLOUD_KEY, normalize(state));
    return true;
  } catch {
    return false;
  }
}

export interface AddStudyLogInput {
  date?: string;
  subject: string;
  topic: string;
  minutes: number;
  recallScore?: number;
}

/** Adds one session. A generated id makes retries safe when the same entry is saved again. */
export function addStudyLogEntry(input: AddStudyLogInput, state = loadStudyLog()): StudyLogState {
  const subject = input.subject.trim();
  const topic = input.topic.trim();
  if (!subject || !topic) throw new Error('Subject and topic are required.');
  if (!Number.isFinite(input.minutes) || input.minutes <= 0 || Math.round(input.minutes) < 1) throw new Error('Study time must be at least one minute.');
  const date = input.date ?? localDateKey();
  if (!isValidDateKey(date)) throw new Error('Study date must be a valid YYYY-MM-DD date.');
  if (input.recallScore !== undefined && (!Number.isFinite(input.recallScore) || input.recallScore < 0 || input.recallScore > 100)) {
    throw new Error('Recall score must be between 0 and 100.');
  }

  const entry: StudyLogEntry = {
    id: `study_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    date,
    subject,
    topic,
    minutes: Math.round(input.minutes),
    ...(input.recallScore === undefined ? {} : { recallScore: input.recallScore }),
    createdAt: new Date().toISOString(),
  };
  return { version: VERSION, entries: [...state.entries.filter(e => e.id !== entry.id), entry] };
}

export function removeStudyLogEntry(id: string, state = loadStudyLog()): StudyLogState {
  return { ...state, entries: state.entries.filter(entry => entry.id !== id) };
}

export function getStudyLogSummary(state = loadStudyLog(), today = localDateKey()): StudyLogSummary {
  const entries = state.entries;
  const todayEntries = entries.filter(entry => entry.date === today);
  const days = new Set(entries.map(entry => entry.date));
  const recall = entries.flatMap(entry => entry.recallScore === undefined ? [] : [entry.recallScore]);
  return {
    totalSessions: entries.length,
    totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    minutesToday: todayEntries.reduce((sum, entry) => sum + entry.minutes, 0),
    sessionsToday: todayEntries.length,
    activeDays: days.size,
    averageRecall: recall.length ? Math.round(recall.reduce((sum, score) => sum + score, 0) / recall.length) : null,
  };
}

/** Hydrate only an empty local store; never overwrite existing device data. */
export async function hydrateStudyLogFromCloud(): Promise<boolean> {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return false;
    const cloud = await pullFromCloud<unknown>(CLOUD_KEY);
    if (!cloud) return false;
    const state = normalize(cloud);
    if (state.entries.length === 0) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
