import type { Goal, Topic, EngagementSession } from './types';
import { getRoadmapData } from './roadmapData';
import { getEngagementSessions } from './engagementStore';
import { getRevisionDataForGoals, getRevisionStats } from './revisionData';

// ============================================================
// progressData.ts
// Pure aggregation layer for the Progress page. Deliberately reads the
// SAME localStorage stores every other page already writes to — no new
// storage key, no new tracking code, no backend call. If a topic/session
// doesn't exist yet, every function below degrades to empty/zero instead
// of throwing, so a brand-new user sees an honest "not started yet" state
// instead of a crash.
// ============================================================

const ACTIVE_DAYS_STORAGE_KEY = 'learning_os_active_days';

// ---------- Streaks ----------
// Read-only mirror of Dashboard.tsx's trackAndComputeStreak() — that
// function also WRITES today's date (it's the one that should own marking
// a day active, since it runs once per app load). This one only reads, so
// visiting the Progress page never itself counts as "being active".
export interface StreakStats {
  currentStreak: number;
  totalActiveDays: number;
}

export function getStreakStats(): StreakStats {
  let activeDays: string[] = [];
  try {
    const saved = localStorage.getItem(ACTIVE_DAYS_STORAGE_KEY);
    activeDays = saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    activeDays = [];
  }
  const activeSet = new Set(activeDays);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!activeSet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { currentStreak: streak, totalActiveDays: activeDays.length };
}

// ---------- Completion % (merged across every active goal) ----------
export interface CompletionStats {
  total: number;
  completed: number;
  learning: number;
  percent: number;
}

export function getCompletionStats(goals: Goal[]): CompletionStats {
  const activeGoals = goals.filter((g) => g.status === 'active');
  const roadmaps = activeGoals.length > 0 ? activeGoals.map((g) => getRoadmapData(g.id)) : [getRoadmapData()];

  let total = 0;
  let completed = 0;
  let learning = 0;
  for (const roadmap of roadmaps) {
    const topics = roadmap.children ?? [];
    total += topics.length;
    completed += topics.filter((t) => t.status === 'completed' || t.status === 'mastered').length;
    learning += topics.filter((t) => t.status === 'learning').length;
  }
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, learning, percent };
}

// ---------- Time tracking ----------
export interface TimeStats {
  totalHours: number;
  todayMinutes: number;
  last7DaysMinutes: number;
  /** Last 7 days, oldest first — minutes watched per day. Powers a small bar chart. */
  dailyMinutes: { label: string; minutes: number }[];
  sessionCount: number;
}

function isSameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return d.toDateString() === day.toDateString();
}

export function getTimeStats(sessions: EngagementSession[] = getEngagementSessions()): TimeStats {
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.watchedSeconds || 0), 0);
  const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

  const today = new Date();
  const todaySeconds = sessions
    .filter((s) => isSameDay(s.sessionTimestamp, today))
    .reduce((sum, s) => sum + (s.watchedSeconds || 0), 0);

  const dailyMinutes: { label: string; minutes: number }[] = [];
  let last7DaysSeconds = 0;
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const daySeconds = sessions
      .filter((s) => isSameDay(s.sessionTimestamp, day))
      .reduce((sum, s) => sum + (s.watchedSeconds || 0), 0);
    last7DaysSeconds += daySeconds;
    dailyMinutes.push({
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: Math.round(daySeconds / 60),
    });
  }

  return {
    totalHours,
    todayMinutes: Math.round(todaySeconds / 60),
    last7DaysMinutes: Math.round(last7DaysSeconds / 60),
    dailyMinutes,
    sessionCount: sessions.length,
  };
}

// ---------- Mastery heatmap + Weak areas (topic-level, driven by roadmap status + real watch signal) ----------
export interface TopicMastery {
  topicId: string;
  title: string;
  status: Topic['status'];
  difficulty: Topic['difficulty'];
  /** 0-100. Roadmap status sets the baseline; actual engagement signal on
   *  that topic's videos (like/dislike/replay) nudges it up or down — so
   *  two "completed" topics can still show different mastery if one was
   *  breezed through and the other was full of replays/dislikes. */
  masteryScore: number;
  sessionCount: number;
  goalTitle?: string;
}

const STATUS_BASELINE: Record<Topic['status'], number> = {
  locked: 0,
  learning: 40,
  completed: 75,
  mastered: 95,
};

const SIGNAL_POINTS: Record<EngagementSession['signal'], number> = {
  like: 10,
  neutral: 0,
  dislike: -15,
  strong_dislike: -25,
};

export function getMasteryHeatmap(goals: Goal[], sessions: EngagementSession[] = getEngagementSessions()): TopicMastery[] {
  const activeGoals = goals.filter((g) => g.status === 'active');
  const roadmapEntries: { roadmap: Topic; goalTitle?: string }[] =
    activeGoals.length > 0
      ? activeGoals.map((g) => ({ roadmap: getRoadmapData(g.id), goalTitle: activeGoals.length > 1 ? g.title : undefined }))
      : [{ roadmap: getRoadmapData() }];

  const result: TopicMastery[] = [];

  for (const { roadmap, goalTitle } of roadmapEntries) {
    for (const topic of roadmap.children ?? []) {
      if (topic.status === 'locked') continue; // not started — nothing to score yet

      const topicSessions = sessions.filter((s) => s.conceptId === topic.id);
      const baseline = STATUS_BASELINE[topic.status];

      let adjusted = baseline;
      if (topicSessions.length > 0) {
        const avgSignalPoints =
          topicSessions.reduce((sum, s) => sum + SIGNAL_POINTS[s.signal], 0) / topicSessions.length;
        adjusted = Math.max(0, Math.min(100, Math.round(baseline + avgSignalPoints)));
      }

      result.push({
        topicId: topic.id,
        title: topic.title,
        status: topic.status,
        difficulty: topic.difficulty,
        masteryScore: adjusted,
        sessionCount: topicSessions.length,
        goalTitle,
      });
    }
  }

  return result;
}

/** Topics that need attention — low mastery among topics actually started. Sorted worst-first. */
export function getWeakAreas(heatmap: TopicMastery[], limit = 5): TopicMastery[] {
  return [...heatmap]
    .filter((t) => t.status !== 'locked' && t.masteryScore < 60)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, limit);
}

// ---------- Retention rate (delegates to the same engine Revision.tsx uses) ----------
export function getRetentionStats(goals: Goal[]) {
  const items = getRevisionDataForGoals(goals);
  return getRevisionStats(items);
}