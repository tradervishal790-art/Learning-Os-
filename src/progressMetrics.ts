export interface TimedEngagement {
  watchedSeconds?: number;
  sessionTimestamp?: string;
}

export interface DailyTimeSummary {
  totalHours: number;
  todayMinutes: number;
  last7DaysMinutes: number;
  dailyMinutes: { label: string; minutes: number }[];
  sessionCount: number;
}

/** YYYY-MM-DD for the learner's own calendar day (device time zone), so the day changes at local midnight. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidUtcDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Keep only real UTC date keys, removing duplicates and malformed local data. */
export function normalizeActiveDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isValidUtcDayKey))].sort();
}

/** A streak remains alive through yesterday if the learner has not opened the app today yet. */
export function calculateCurrentStreak(activeDays: readonly string[], now = new Date()): number {
  const active = new Set(normalizeActiveDays(activeDays));
  if (!Number.isFinite(now.getTime())) return 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const key = localDayKey(cursor);
  if (!active.has(key)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (active.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function utcDayKey(value: string): string | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? localDayKey(new Date(timestamp)) : null;
}

/** Ignore corrupt, negative or non-finite sessions before computing learner-facing metrics. */
export function summarizeEngagementTime(
  sessions: readonly TimedEngagement[],
  now = new Date(),
  /** Extra study seconds per UTC day that are not video sessions (e.g. active Revision time). */
  extraSecondsByDay: Readonly<Record<string, number>> = {},
): DailyTimeSummary {
  const valid = sessions.filter((session) =>
    Number.isFinite(session.watchedSeconds)
    && (session.watchedSeconds ?? 0) > 0
    && typeof session.sessionTimestamp === 'string'
    && utcDayKey(session.sessionTimestamp) !== null
  );
  let totalSeconds = valid.reduce((sum, session) => sum + (session.watchedSeconds ?? 0), 0);
  const todayKey = Number.isFinite(now.getTime()) ? localDayKey(now) : '';
  const byDay = new Map<string, number>();
  for (const session of valid) {
    const key = utcDayKey(session.sessionTimestamp!);
    if (key) byDay.set(key, (byDay.get(key) ?? 0) + (session.watchedSeconds ?? 0));
  }

  for (const [key, seconds] of Object.entries(extraSecondsByDay)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(seconds) && seconds > 0) {
      byDay.set(key, (byDay.get(key) ?? 0) + seconds);
      totalSeconds += seconds;
    }
  }

  const dailyMinutes: DailyTimeSummary['dailyMinutes'] = [];
  let last7DaysSeconds = 0;
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12);
    const key = localDayKey(day);
    const seconds = byDay.get(key) ?? 0;
    last7DaysSeconds += seconds;
    dailyMinutes.push({
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: Math.round(seconds / 60),
    });
  }

  return {
    totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
    todayMinutes: Math.round((byDay.get(todayKey) ?? 0) / 60),
    last7DaysMinutes: Math.round(last7DaysSeconds / 60),
    dailyMinutes,
    sessionCount: valid.length,
  };
}
