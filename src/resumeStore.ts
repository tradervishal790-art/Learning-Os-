// src/resumeStore.ts
// Remembers the ONE place the learner stopped (a video at a timestamp, or a revision card)
// so "Continue learning" on the home screen can drop them exactly there.
// localStorage only, best effort; a stale or finished point is simply ignored.

const KEY = 'learning_os_resume_point';

export type ResumePoint =
  | { kind: 'video'; goalId: string | null; topicId: string; videoId: string; seconds: number; title: string; at: number }
  | { kind: 'revision'; itemId: string; title: string; at: number };

export type ContinueTarget =
  | { type: 'video'; point: Extract<ResumePoint, { kind: 'video' }> }
  | { type: 'revision'; point: Extract<ResumePoint, { kind: 'revision' }> | null }
  | { type: 'test' }
  | { type: 'topic' }
  | { type: 'roadmap' };

export function getResume(): ResumePoint | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ResumePoint;
    if (p?.kind === 'video' && typeof p.videoId === 'string' && typeof p.topicId === 'string' && Number.isFinite(p.seconds)) return p;
    if (p?.kind === 'revision' && typeof p.itemId === 'string') return p;
    return null;
  } catch { return null; }
}

export function setResume(point: ResumePoint): void {
  try { localStorage.setItem(KEY, JSON.stringify(point)); } catch { /* best effort */ }
}

export function clearResume(kind?: ResumePoint['kind']): void {
  try {
    if (kind) { const cur = getResume(); if (cur && cur.kind !== kind) return; }
    localStorage.removeItem(KEY);
  } catch { /* best effort */ }
}

/** Saves the video position. Ignores the first seconds (nothing worth resuming). */
export function saveVideoPosition(p: { goalId: string | null; topicId: string; videoId: string; seconds: number; title: string }): void {
  if (p.seconds < 5) return;
  setResume({ kind: 'video', ...p, seconds: Math.floor(p.seconds), at: Date.now() });
}

export function getVideoSeekSeconds(topicId: string | null | undefined, videoId: string): number {
  const p = getResume();
  return p && p.kind === 'video' && p.videoId === videoId && (!topicId || p.topicId === topicId) ? p.seconds : 0;
}

/**
 * Decides where "Continue learning" goes. Order:
 * 1) a half-finished video or revision card the learner left (most recent wins, only if still valid),
 * 2) a test that was started but not submitted,
 * 3) the current roadmap topic, 4) the roadmap.
 * `topicStillLearning` / `revisionStillOpen` stop us resuming something that is already finished.
 */
export function pickContinueTarget(input: {
  resume: ResumePoint | null;
  hasTestDraft: boolean;
  currentTopicId: string | null;
  openRevisionIds: string[];
}): ContinueTarget {
  const { resume, hasTestDraft, currentTopicId, openRevisionIds } = input;
  if (resume?.kind === 'revision' && openRevisionIds.includes(resume.itemId)) return { type: 'revision', point: resume };
  if (resume?.kind === 'video' && currentTopicId === resume.topicId) return { type: 'video', point: resume };
  if (hasTestDraft) return { type: 'test' };
  if (currentTopicId) return { type: 'topic' };
  return { type: 'roadmap' };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}
