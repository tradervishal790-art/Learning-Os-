// roadmapWatch.ts
//
// Pure rule for "the learner watched a video that was opened FROM a roadmap topic".
// Finishing the class (watching it through) completes THAT topic and opens the next one —
// revision is a separate schedule (revisionData.ts) that keeps running on its own clock
// and never decides whether the next class is available.

import type { Topic } from './types';

/** Watched this much of the video: the topic counts as started. */
export const WATCH_STARTED_PCT = 70;
/** Watched this much: the class is done. */
export const WATCH_DONE_PCT = 85;

export interface WatchResult {
  /** The topic exists in this roadmap (so the caller must not also try title matching). */
  found: boolean;
  /** The updated roadmap, or null when nothing needs saving. */
  roadmap: Topic | null;
}

export function applyWatchToTopic(roadmap: Topic, topicId: string, watchPercentage: number, now: Date = new Date()): WatchResult {
  const children = roadmap.children ?? [];
  const index = children.findIndex((c) => c.id === topicId);
  if (index === -1) return { found: false, roadmap: null };
  if (watchPercentage < WATCH_STARTED_PCT) return { found: true, roadmap: null };

  const topic = children[index];
  // Already completed/mastered: never move a topic backwards.
  if (topic.status !== 'locked' && topic.status !== 'learning') return { found: true, roadmap: null };

  const stamp = now.toISOString();
  const next = [...children];

  if (watchPercentage < WATCH_DONE_PCT) {
    if (topic.status === 'learning') return { found: true, roadmap: null };
    next[index] = { ...topic, status: 'learning', learningStartedAt: stamp };
    return { found: true, roadmap: { ...roadmap, children: next } };
  }

  // Class finished. Keep (or start) the revision clock for this topic, then open the next class.
  next[index] = { ...topic, status: 'completed', learningStartedAt: topic.learningStartedAt ?? stamp };
  for (let i = index + 1; i < next.length; i++) {
    if (next[i].status === 'locked') {
      next[i] = { ...next[i], status: 'learning', learningStartedAt: stamp };
      break;
    }
  }
  return { found: true, roadmap: { ...roadmap, children: next } };
}
