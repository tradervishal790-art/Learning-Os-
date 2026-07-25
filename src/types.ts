// ============================================================
// SHARED TYPES — Learning OS
// Centralizing types here avoids scattered `any` usage and keeps
// onboarding data, roadmap topics, revision items, and video
// tracking data consistent across every component.
// ============================================================

// ---------- Onboarding ----------
export interface UserOnboardingData {
  role: string;
  goal: string;
  language: string;
  hours: number;
  deadline: string;
}

// ---------- Roadmap / Topics ----------
export type TopicStatus = 'mastered' | 'completed' | 'learning' | 'locked';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Topic {
  id: string;
  title: string;
  description: string;
  status: TopicStatus;
  estimatedTime: string;
  difficulty: Difficulty;
  why: {
    learn: string;
    connect: string;
    system: string;
    risk: string;
  };
  children?: Topic[];
  /** Short lowercase keywords/phrases used to match this topic against watched video titles. */
  topicKeywords?: string[];
}


// ---------- Revision / Spaced Repetition ----------
export type RevisionStatus = 'due-today' | 'upcoming' | 'overdue' | 'mastered';
export type RevisionDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface RevisionItem {
  id: string;
  topic: string;
  category: string;
  day: number;
  dueDate: string;
  status: RevisionStatus;
  difficulty: RevisionDifficulty;
  retention: number;
}

// ---------- Video Intelligence ----------
export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  views: string;
  duration: string;
}

export interface VideoWatchData {
  videoId: string;
  title: string;
  watchedDuration: number;
  totalDuration: number;
  watchPercentage: number;
  pauseCount: number;
  rewindCount: number;
  playbackSpeed: number;
  completedAt?: Date;
}

export interface WatchHistoryEntry {
  videoId: string;
  title: string;
  watchPercentage: number;
  aiScore: number;
}

// ---------- Video Engagement Tracking ----------
// Mirrors the `video_engagement` table schema: one row per watch session.
export type EngagementSignal = 'like' | 'dislike' | 'neutral' | 'strong_dislike';
export type FeedbackValue = 'like' | 'dislike' | null;

export interface EngagementSession {
  id: string; // session id (unique per watch session, not per video)
  videoId: string;
  userId: string; // TODO: replace 'guest' with real auth uid once Firebase Auth is wired in
  totalDuration: number;
  watchedSeconds: number;
  watchPercentage: number;
  pauseCount: number;
  seekForwardCount: number;
  replayCount: number;
  completed: boolean;
  timeToFirstPause: number | null; // seconds from play start to first pause; null if never paused
  feedback: FeedbackValue;
  signal: EngagementSignal;
  sessionTimestamp: string; // ISO string — when this session started
}

// ---------- Placeholder pages (AI Notes, AI Mentor, Progress) ----------
export type PageStatus = 'coming-soon' | 'beta' | 'active';

export interface PageConfig {
  title: string;
  description: string;
  icon: string;
  status: PageStatus;
  features: string[];
}

export type DashboardPageId =
  | 'dashboard'
  | 'roadmap'
  | 'revision'
  | 'notes'
  | 'videos'
  | 'mentor'
  | 'progress';
  // ---------- Learning Style Profile ----------
export interface LearningProfile {
  pace: number;
  theoryVsPractical: number;
  structureNeed: number;
  depth: number;
  languageComplexity: number;
  storytelling: number;
  repetitionNeed: number;
  priorKnowledgeComfort: number;
  reliabilityScore: number;
  selfReportedHonesty: 'honest' | 'partially_honest' | 'gamed' | 'declined';
  completedAt: string;
}
export type QuizAnswerValue = 'A' | 'B' | 'C' | 'D';
export interface QuizAnswer {
  questionId: string;
  value: QuizAnswerValue;
}