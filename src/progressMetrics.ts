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
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let key = cursor.toISOString().slice(0, 10);
  if (!active.has(key)) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function utcDayKey(value: string): string | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

/** Ignore corrupt, negative or non-finite sessions before computing learner-facing metrics. */
export function summarizeEngagementTime(
  sessions: readonly TimedEngagement[],
  now = new Date(),
): DailyTimeSummary {
  const valid = sessions.filter((session) =>
    Number.isFinite(session.watchedSeconds)
    && (session.watchedSeconds ?? 0) > 0
    && typeof session.sessionTimestamp === 'string'
    && utcDayKey(session.sessionTimestamp) !== null
  );
  const totalSeconds = valid.reduce((sum, session) => sum + (session.watchedSeconds ?? 0), 0);
  const todayKey = Number.isFinite(now.getTime()) ? now.toISOString().slice(0, 10) : '';
  const byDay = new Map<string, number>();
  for (const session of valid) {
    const key = utcDayKey(session.sessionTimestamp!);
    if (key) byDay.set(key, (byDay.get(key) ?? 0) + (session.watchedSeconds ?? 0));
  }

  const dailyMinutes: DailyTimeSummary['dailyMinutes'] = [];
  let last7DaysSeconds = 0;
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    const seconds = byDay.get(key) ?? 0;
    last7DaysSeconds += seconds;
    dailyMinutes.push({
      label: day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
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
