// ============================================================
// SHARED TYPES — Learning OS
// Centralizing types here avoids scattered `any` usage and keeps
// onboarding data, roadmap topics, revision items, and video
// tracking data consistent across every component.
// ============================================================

// ---------- Onboarding ----------

export interface UserOnboardingData {
  name: string;        // ← already added (Settings ke liye)
  role: string;
  goal: string;
  language: string;
  hours: number;       // ← ADD THIS LINE
  deadline: string;
  /** Exact deadline in days, when set via the Day/Week/Month slider (Roadmap
   *  page's inline generate form). Takes priority over the coarse `deadline`
   *  string bucket when present — lets the time-budget calc be precise
   *  instead of snapping to one of 5 fixed presets. */
  deadlineDays?: number;
}


// ---------- Goals (multi-goal support) ----------
// A user can run up to 2 goals at once. Each goal owns its own roadmap
// (stored separately, keyed by goal id — see roadmapData.ts). Ending a
// goal frees a slot for a new one without losing the old roadmap's data.
export type GoalStatus = 'active' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  /** Subject/topic typed by the user — same as onboarding's `goal` field. */
  title: string;
  hours: number;
  deadline: string;
  deadlineDays?: number;
  status: GoalStatus;
  createdAt: string;
  endedAt?: string;
}

// ---------- Playlist timing (moved out of onboarding, asked at playlist-creation time) ----------
export interface PlaylistTiming {
  hours: number;
  deadline: string;
}

// ---------- Theme ----------
export type ThemeMode = 'dark' | 'light';

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
  /** ISO timestamp of when this topic's status first became 'learning' —
   *  the anchor date the Revision engine schedules Day 1/3/7/15/30/60
   *  spaced-repetition checkpoints from. Absent for topics never started. */
  learningStartedAt?: string;
}


// ---------- Revision / Spaced Repetition ----------
export type RevisionStatus = 'due-today' | 'upcoming' | 'overdue' | 'mastered';
export type RevisionDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface RevisionItem {
  id: string;
  /** Roadmap topic this checkpoint belongs to — needed to persist "reviewed"
   *  state back to the actual topic when the user marks it done. */
  topicId: string;
  topic: string;
  category: string;
  day: number;
  dueDate: string;
  status: RevisionStatus;
  difficulty: RevisionDifficulty;
  retention: number;
  /** What to actually do on this checkpoint's day — replaces the old
   *  standalone "Learning Path" tab in Notes.tsx. Pulled from that topic's
   *  cached Deep Notes (grounded to the actual video) when available,
   *  otherwise a generic spaced-repetition task for this day number. */
  task: string;
}

// ---------- Topic-to-topic connection ("bridge") ----------
// Shown right before the next topic's video starts, so the learner sees
// how the video they're about to watch connects to what they just
// finished — instead of every video feeling like an unrelated, standalone
// clip. Built from the just-completed topic's title + the next topic's
// own `why.connect` (already written with exactly this purpose in mind
// by generate-roadmap.ts, previously only shown buried inside the topic
// modal's "Why" tab).
export interface TopicBridge {
  fromTopicTitle: string;
  toTopicTitle: string;
  connectText: string;
}

// ---------- Video Intelligence ----------
export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelId: string; // unique teacher identity — used as teacherId by PlaylistBuilder
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
  teacherId?: string; // video's channelId — used by PlaylistBuilder for teacher-affinity scoring
  conceptId?: string; // matched roadmap Topic.id — used by PlaylistBuilder for concept-based rerank
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
  // Which scoring path produced the video this session watched — 'control' is the
  // existing dimensionMatch-only PlaylistBuilder logic, 'personality_v1' is the
  // parallel personality-type engine (personalityEngine.ts). Optional so existing
  // stored sessions (pre-experiment) remain valid without a migration.
  variant?: 'control' | 'personality_v1';
}

// ---------- Placeholder pages (Notes, Mentor, Progress) ----------
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
  | 'progress'
  | 'research';
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
  // Written narrative report from the live AI Blueprint Interview
  // (BlueprintInterview.tsx) — optional because profiles built by the
  // older static quiz (LearningQuiz.tsx) or blended via Deep Dive don't
  // have one.
  blueprintReport?: string;
}
export type QuizAnswerValue = 'A' | 'B' | 'C' | 'D';
export interface QuizAnswer {
  questionId: string;
  value: QuizAnswerValue;
}
// ---------- Result envelope for API-calling functions ----------
// Distinguishes "call failed" from "call succeeded but found nothing"
export type FailureStage =
  | 'query-expansion'
  | 'video-search'
  | 'video-analysis'
  | 'config'
  | 'unknown';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; stage: FailureStage; reason: string };

// ---------- Teacher-style analysis source tracking ----------
export type AnalysisSource = 'transcript' | 'metadata-fallback';

// ---------- Video-taste onboarding (TasteOnboarding.tsx) ----------
// Alternative to the Blueprint Interview / old quiz — user submits YouTube
// videos they've already fully watched (45+ min each), and each one is
// analyzed for both content (teaching-style dimensions, same as
// analyze-video.ts) and production style (music/editing/pacing, from
// sampled clips). See api/analyze-taste-video.ts.
export interface VideoStyleProfile {
  music_presence: boolean;
  music_energy: 'none' | 'low' | 'medium' | 'high';
  visual_style: 'talking-head' | 'slides' | 'screen-recording' | 'animation' | 'mixed';
  cut_frequency: 'low' | 'medium' | 'high';
  on_screen_text: boolean;
  pacing_feel: 'calm' | 'moderate' | 'energetic';
  notes: string;
}

export interface TasteVideoResult {
  videoId: string;
  title: string;
  durationSeconds: number;
  // Raw dimension scores as returned by the API (snake_case keys, 1-10) —
  // mapped to LearningProfile's camelCase DimensionKeys by
  // tasteProfileScoring.ts before merging.
  contentProfile: Record<string, any>;
  analysisSource: AnalysisSource;
  styleProfile: VideoStyleProfile | null;
  styleAnalysisError?: string;
}

// ---------- localStorage cache envelopes ----------
export interface CachedQueryExpansion {
  cacheKey: string;
  queries: string[];
  cachedAt: string;
}

export interface CachedCandidatePool {
  cacheKey: string;
  videoIds: string[];
  cachedAt: string;
}