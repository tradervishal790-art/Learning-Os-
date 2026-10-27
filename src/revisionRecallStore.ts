import { pushToCloud, pullFromCloud } from './cloudSync';

// Recall scores are separate from completion checkpoints: finishing a review
// must not be treated as proof that the learner remembered the topic.
const LOCAL_KEY = 'learning_os_revision_recall';
const CLOUD_KEY = 'revisionRecallScores';

export type RecallRating = 'forgot' | 'partial' | 'remembered';

export interface RecallRecord {
  topicId: string;
  day: number;
  rating: RecallRating;
  recordedAt: string;
}

type RecallMap = Record<string, RecallRecord[]>;

function readAll(): RecallMap {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as RecallMap : {};
  } catch {
    return {};
  }
}

function writeAll(value: RecallMap): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  } catch {
    // Keep the revision flow usable when browser storage is unavailable.
  }
  void pushToCloud(CLOUD_KEY, value);
}

export function getRecallRecords(topicId?: string): RecallRecord[] {
  const all = readAll();
  if (topicId) return Array.isArray(all[topicId]) ? all[topicId] : [];
  return Object.entries(all).flatMap(([key, records]) =>
    Array.isArray(records) ? records.filter(isRecallRecord).filter((record) => record.topicId === key) : []
  );
}

function isRecallRecord(value: unknown): value is RecallRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RecallRecord>;
  return typeof record.topicId === 'string'
    && record.topicId.trim().length > 0
    && typeof record.day === 'number'
    && Number.isInteger(record.day)
    && record.day > 0
    && (record.rating === 'forgot' || record.rating === 'partial' || record.rating === 'remembered')
    && typeof record.recordedAt === 'string'
    && record.recordedAt.trim().length > 0
    && !Number.isNaN(Date.parse(record.recordedAt));
}

/** Store or replace the score for this topic's checkpoint; repeated clicks are idempotent. */
export function saveRecallRating(topicId: string, day: number, rating: RecallRating): RecallRecord {
  if (!topicId.trim() || !Number.isInteger(day) || day <= 0) {
    throw new Error('A valid topic ID and positive checkpoint day are required.');
  }
  if (rating !== 'forgot' && rating !== 'partial' && rating !== 'remembered') {
    throw new Error('Invalid recall rating.');
  }
  const all = readAll();
  const existing = Array.isArray(all[topicId])
    ? all[topicId].filter(isRecallRecord).filter((item) => item.topicId === topicId)
    : [];
  const record: RecallRecord = { topicId, day, rating, recordedAt: new Date().toISOString() };
  all[topicId] = [...existing.filter((item) => item.day !== day), record].sort((a, b) => a.day - b.day);
  writeAll(all);
  return record;
}

/** One-time, local-first hydration: never overwrite existing device history. */
export async function hydrateRecallScoresFromCloud(): Promise<void> {
  if (Object.keys(readAll()).length > 0) return;
  const cloud = await pullFromCloud<unknown>(CLOUD_KEY);
  if (!cloud || typeof cloud !== 'object' || Array.isArray(cloud)) return;
  const safe: RecallMap = {};
  for (const [topicId, records] of Object.entries(cloud as Record<string, unknown>)) {
    if (Array.isArray(records)) {
      const valid = records.filter(isRecallRecord).filter((record) => record.topicId === topicId);
      const uniqueByDay = new Map<number, RecallRecord>();
      for (const record of valid) {
        const previous = uniqueByDay.get(record.day);
        if (!previous || Date.parse(record.recordedAt) > Date.parse(previous.recordedAt)) uniqueByDay.set(record.day, record);
      }
      const cleaned = [...uniqueByDay.values()].sort((a, b) => a.day - b.day);
      if (cleaned.length) safe[topicId] = cleaned;
    }
  }
  if (Object.keys(safe).length === 0) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
  } catch {
    // Best-effort hydration.
  }
}

/** Overall observed recall percentage; returns null until at least one score exists. */
export function getRecallAccuracy(): number | null {
  const records = getRecallRecords();
  if (!records.length) return null;
  const points = records.reduce((sum, record) => sum + (record.rating === 'remembered' ? 100 : record.rating === 'partial' ? 50 : 0), 0);
  return Math.round(points / records.length);
}


export interface RecallTrendPoint {
  date: string;
  label: string;
  accuracy: number | null;
  attempts: number;
}

/** Seven local-calendar days of observed recall; empty days stay null, not zero. */
export function getRecallTrend(now: Date = new Date()): RecallTrendPoint[] {
  const records = getRecallRecords();
  const points: RecallTrendPoint[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const dayRecords = records.filter((record) => {
      const recorded = new Date(record.recordedAt);
      if (Number.isNaN(recorded.getTime())) return false;
      const recordedDate = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, '0')}-${String(recorded.getDate()).padStart(2, '0')}`;
      return recordedDate === date;
    });
    const score = dayRecords.length
      ? Math.round(dayRecords.reduce((sum, record) => sum + (record.rating === 'remembered' ? 100 : record.rating === 'partial' ? 50 : 0), 0) / dayRecords.length)
      : null;
    points.push({
      date,
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      accuracy: score,
      attempts: dayRecords.length,
    });
  }
  return points;
}
