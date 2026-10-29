// One place that turns "next topic" into a ready lecture (primary video + fallbacks).
// Used by the Roadmap's Watch button AND by the background prefetch that warms the
// next lecture while the learner is on Home, so Start opens instantly.
//
// Cost model (why prefetch is cheap): the build is the same work Watch already does,
// just earlier. It runs at most ONCE per topic (result cached 7 days), never for
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

// ---------------------------------------------------------------- prefetch cache

const CACHE_KEY = 'learning_os_lecture_prefetch';
const FAIL_KEY = 'learning_os_lecture_prefetch_fail';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAIL_BACKOFF_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 6;

interface Entry {
  sig: string;
  primary: Video;
  fallbacks: Video[];
  teachingProcess: TeachingProcess | null;
  at: number;
}

/** Anything that changes which video would be picked changes the signature, so a stale prefetch is never used. */
export function lectureSignature(input: Pick<LectureInput, 'userData' | 'goalTitle' | 'hours' | 'deadline'>): string {
  const p = getLearningProfileOrNeutral();
  return [
    input.userData?.language ?? '',
    input.goalTitle ?? input.userData?.goal ?? '',
    input.hours ?? 0,
    input.deadline ?? '',
    p.pace, p.theoryVsPractical, p.depth, p.structureNeed, p.storytelling, p.languageComplexity, p.repetitionNeed, p.priorKnowledgeComfort,
  ].join('|');
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

/** Returns a prepared lecture for this topic (and removes it, so a later manual Watch searches fresh again). */
export function takePrefetchedLecture(topicId: string, sig: string): Entry | null {
  const all = readAll();
  const e = all[topicId];
  if (!fresh(e, sig)) return null;
  delete all[topicId];
  writeAll(all);
  return e;
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
    if (fresh(readAll()[topic.id], sig)) return;

    inFlight.add(topic.id);
    const r = await buildLecture({ ...input, forceRefresh: false });
    if (!r.ok) {
      markFailed();
      return;
    }
    const all = readAll();
    all[topic.id] = { sig, primary: r.primary, fallbacks: r.fallbacks, teachingProcess: r.teachingProcess, at: Date.now() };
    writeAll(all);
  } catch {
    markFailed();
  } finally {
    inFlight.delete(topic.id);
  }
}
