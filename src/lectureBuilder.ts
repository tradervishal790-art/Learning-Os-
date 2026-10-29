// One place that turns "next topic" into a ready lecture (primary video + fallbacks).
// Used by the Roadmap's Watch button AND by the background prefetch that warms the
// next lecture while the learner is on Home, so Start opens instantly.
//
// Cost model (why attaching is cheap): the build is the same work Watch already does,
// just earlier. It runs at most ONCE per topic (the result stays attached until the
// topic is completed), never for
// guests, never offline / on data-saver, never when a video is already saved for the
// topic, and it backs off for 30 min after a failure. The prefetch also uses the
// local + shared topic-pool caches (the manual Watch path forces a fresh search).
import type { Topic, Video, UserOnboardingData } from './types';
import type { TeachingProcess } from './personalityEngine';
import { buildCandidatePoolForConcept } from './conceptVideoPool';
import { selectPlaylistForConceptV2, analyzedVideoToVideo, getLastTeacherForConcept } from './PlaylistBuilder';
import { getLearningProfileOrNeutral } from './learningProfileStore';
import { expandSearchQuery } from './queryExpander';
import { hasSavedVideoForTopic } from './VideoIntel';

export interface LectureInput {
  topic: Topic;
  userData?: UserOnboardingData | null;
  /** Title of the CURRENTLY ACTIVE goal (not the global onboarding goal). */
  goalTitle?: string;
  hours?: number;
  deadline?: string;
  forceRefresh?: boolean;
}

export type LectureResult =
  | { ok: true; primary: Video; fallbacks: Video[]; teachingProcess: TeachingProcess | null }
  | { ok: false; reason: 'no-candidates' | 'no-playlist' };

export async function buildLecture(input: LectureInput): Promise<LectureResult> {
  const { topic, userData, goalTitle, forceRefresh = true } = input;
  const hours = input.hours ?? 0;
  const deadline = input.deadline ?? '';
  // No quiz yet? A neutral profile still finds a good lecture.
  const learnerProfile = getLearningProfileOrNeutral();

  let queries: string[] | undefined;
  if (userData) {
    const blueprint = {
      role: userData.role,
      goal: goalTitle ?? userData.goal,
      language: userData.language,
      hours: hours || userData.hours,
      style: {
        pace: learnerProfile.pace,
        practical: learnerProfile.theoryVsPractical,
        depth: learnerProfile.depth,
        structure: learnerProfile.structureNeed,
        storytelling: learnerProfile.storytelling,
        languageComplexity: learnerProfile.languageComplexity,
      },
    };
    try {
      const expansion = await expandSearchQuery(topic.title, blueprint);
      if (expansion?.queries && expansion.queries.length > 0) queries = expansion.queries;
    } catch {
      // Expansion failed — the pool falls back to cleaned-title queries on its own.
    }
  }

  const candidates = await buildCandidatePoolForConcept(topic, queries, userData?.language, forceRefresh);
  if (candidates.length === 0) return { ok: false, reason: 'no-candidates' };

  const result = selectPlaylistForConceptV2(candidates, learnerProfile, getLastTeacherForConcept(topic.id), { hours, deadline });
  if (!result) return { ok: false, reason: 'no-playlist' };

  return {
    ok: true,
    primary: analyzedVideoToVideo(result.primary),
    fallbacks: result.fallbacks.map(analyzedVideoToVideo),
    teachingProcess: result.teachingProcess ?? null,
  };
}

// ---------------------------------------------------------------- attached lectures
// A lecture is ATTACHED to its roadmap topic and stays attached until the topic is
// completed — so coming back never searches again. Completing a topic attaches the
// NEXT topic's lecture (Roadmap.handleMarkComplete) and Home attaches the current one
// as a fallback. Stored per device (localStorage); a new device builds once.

const CACHE_KEY = 'learning_os_lecture_prefetch';
const FAIL_KEY = 'learning_os_lecture_prefetch_fail';
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const FAIL_BACKOFF_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 12;

interface Entry {
  sig: string;
  primary: Video;
  fallbacks: Video[];
  teachingProcess: TeachingProcess | null;
  at: number;
}

/** Only things that make an attached video wrong for this learner: language and goal. (Profile tweaks never force a re-search.) */
export function lectureSignature(input: Pick<LectureInput, 'userData' | 'goalTitle'>): string {
  return [input.userData?.language ?? '', input.goalTitle ?? input.userData?.goal ?? ''].join('|');
}

function readAll(): Record<string, Entry> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Entry>): void {
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    // Best-effort cache.
  }
}

function fresh(e: Entry | undefined, sig: string): e is Entry {
  return !!e && e.sig === sig && Date.now() - e.at < TTL_MS && !!e.primary;
}

/** The lecture attached to this topic, if any. Reading never removes it. */
export function getAttachedLecture(topicId: string, sig: string): Entry | null {
  const e = readAll()[topicId];
  return fresh(e, sig) ? e : null;
}

export function attachLecture(topicId: string, sig: string, lecture: Extract<LectureResult, { ok: true }>): void {
  const all = readAll();
  all[topicId] = { sig, primary: lecture.primary, fallbacks: lecture.fallbacks, teachingProcess: lecture.teachingProcess, at: Date.now() };
  writeAll(all);
}

/** Called when the topic is completed: its video is done, the next topic gets its own. */
export function clearAttachedLecture(topicId: string): void {
  const all = readAll();
  if (!(topicId in all)) return;
  delete all[topicId];
  writeAll(all);
}

function failedRecently(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(FAIL_KEY) || 0) < FAIL_BACKOFF_MS;
  } catch {
    return false;
  }
}

function markFailed(): void {
  try {
    localStorage.setItem(FAIL_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

const inFlight = new Set<string>();

/** Warm the next lecture in the background. Silent: never throws, never touches the UI. */
export async function prefetchNextLecture(input: LectureInput & { goalId?: string | null }): Promise<void> {
  const { topic } = input;
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    if (inFlight.has(topic.id) || failedRecently()) return;
    if (hasSavedVideoForTopic(input.goalId ?? undefined, topic.id)) return;
    const sig = lectureSignature(input);
    if (getAttachedLecture(topic.id, sig)) return;

    inFlight.add(topic.id);
    const r = await buildLecture({ ...input, forceRefresh: false });
    if (!r.ok) {
      markFailed();
      return;
    }
    attachLecture(topic.id, sig, r);
  } catch {
    markFailed();
  } finally {
    inFlight.delete(topic.id);
  }
}
