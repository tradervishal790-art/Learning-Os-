import type { Topic } from './types';

// Re-export Topic so existing `import { roadmapData, type Topic } from './roadmapData'`
// statements elsewhere in the app keep working without changes.
export type { Topic };

const GENERATED_ROADMAP_STORAGE_KEY = 'learning_os_generated_roadmap';

// Shown when the user hasn't completed onboarding yet, or the generated
// roadmap failed to save/parse — keeps Roadmap.tsx renderable either way.
const FALLBACK_ROADMAP: Topic = {
  id: 'no-roadmap',
  title: 'Your Roadmap Awaits',
  description: 'Complete onboarding to generate your personalized learning roadmap.',
  status: 'locked',
  estimatedTime: '—',
  difficulty: 'Beginner',
  why: {
    learn: 'Complete the onboarding flow so we can generate a roadmap tailored to your goal and background.',
    connect: 'This roadmap will connect to your onboarding answers — role, goal, language, hours, and deadline.',
    system: 'Part of your personalized Learning OS journey.',
    risk: 'Without completing onboarding, you will not have a roadmap tailored to you.',
  },
  children: [],
};

/**
 * Resolves the localStorage key for a given goal's roadmap. goalId
 * 'primary' (or omitted, for old callers) aliases the original flat key —
 * this is what lets pre-multi-goal users' roadmaps keep working with zero
 * data migration. Any other goalId gets its own suffixed key, so a 2nd
 * simultaneous goal never touches the 1st goal's roadmap.
 */
function storageKeyFor(goalId?: string): string {
  return goalId && goalId !== 'primary' ? `${GENERATED_ROADMAP_STORAGE_KEY}:${goalId}` : GENERATED_ROADMAP_STORAGE_KEY;
}

/** Reads the AI-generated roadmap for a given goal (or the legacy/primary
 *  roadmap if no goalId is passed) saved to localStorage after onboarding. */
export function getRoadmapData(goalId?: string): Topic {
  try {
    const saved = localStorage.getItem(storageKeyFor(goalId));
    if (!saved) return FALLBACK_ROADMAP;
    const parsed = JSON.parse(saved) as Topic;
    if (!parsed || !parsed.id || !Array.isArray(parsed.children)) return FALLBACK_ROADMAP;
    return parsed;
  } catch {
    return FALLBACK_ROADMAP;
  }
}

/** Saves a generated roadmap under the given goal's key. Single source of
 *  truth for the key naming so App.tsx doesn't duplicate storageKeyFor logic. */
export function saveRoadmapData(goalId: string | undefined, roadmap: Topic): void {
  try {
    localStorage.setItem(storageKeyFor(goalId), JSON.stringify(roadmap));
  } catch {
    // Storage full/unavailable — non-critical, just won't persist.
  }
}

/**
 * Recursively find a topic by id anywhere in the roadmap tree.
 * Lets other components (e.g. Revision, VideoIntel) look up a
 * topic's metadata without duplicating traversal logic.
 */
export function findTopicById(id: string, node: Topic = getRoadmapData()): Topic | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findTopicById(id, child);
    if (found) return found;
  }
  return undefined;
}

/** The topic the user is currently working through — powers Dashboard's "Today's Goal" card. */
export function getCurrentTopic(roadmap: Topic = getRoadmapData()): Topic | undefined {
  return roadmap.children?.find((t) => t.status === 'learning');
}

/** Aggregate progress stats for the top-level roadmap topics. */
export function getRoadmapProgress(roadmap: Topic = getRoadmapData()) {
  const topics = roadmap.children ?? [];
  const total = topics.length;
  const completed = topics.filter((t) => t.status === 'completed' || t.status === 'mastered').length;
  const learning = topics.filter((t) => t.status === 'learning').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, learning, percent };
}