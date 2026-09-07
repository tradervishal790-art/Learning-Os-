// personalityEngine.ts
//
// Parallel personality-type teaching engine. Does NOT modify learningProfileScoring.ts,
// PlaylistBuilder.ts, or learningProfileStore.ts — it reads a LearningProfile and
// EngagementSession history and produces a type label + teaching-process config that
// callers (Roadmap.tsx, PlaylistBuilder.ts's V2 wrapper) opt into via getOrAssignVariant().
//
// Design constraints (decided):
// - The quiz/Blueprint-Interview result is a STARTING PRIOR, not a fixed label.
//   Classification is re-derived from the (possibly-updated) profile every call —
//   never cached as a locked type.
// - Trait scores drift via a ROLLING WINDOW of recent behavioral signal (last N
//   sessions), not a lifetime aggregate — old behavior ages out.
// - Blending is gradual (weighted average), never a discrete type-switch.
// - No transparency notification is fired when the profile updates — updates are silent.
// - Diverse-type videos are occasionally injected on purpose to avoid a filter-bubble
//   feedback loop where the system only ever reinforces its own classification.

import type { LearningProfile, EngagementSession } from './types';

export type PersonalityType = 'Diverging' | 'Assimilating' | 'Converging' | 'Accommodating';

export interface TeachingProcess {
  type: PersonalityType;
  videoStructure: string;
  pacing: string;
  presentationStyle: string;
  avoid: string;
  pushStrategy: string;
  pushTrigger: 'on_video_end' | 'on_checklist_complete' | 'on_challenge_submit';
}

export const TEACHING_PROCESS: Record<PersonalityType, TeachingProcess> = {
  Diverging: {
    type: 'Diverging',
    videoStructure: 'Brainstorm-style intros, multiple perspectives, visual mind-maps',
    pacing: 'Slow start, exploratory',
    presentationStyle: 'Discussion-style, "what if" framing, group-idea videos',
    avoid: 'Forcing a quick single-answer format',
    pushStrategy: 'Show 2-3 approaches, ask them to pick one before advancing',
    pushTrigger: 'on_checklist_complete',
  },
  Assimilating: {
    type: 'Assimilating',
    videoStructure: 'Lecture/analytical model videos, structured notes-style',
    pacing: 'Steady, methodical',
    presentationStyle: 'Theory-driven, logical build-up',
    avoid: 'Hands-on-first without concepts',
    pushStrategy: 'Auto-advance once the concept checklist is complete',
    pushTrigger: 'on_checklist_complete',
  },
  Converging: {
    type: 'Converging',
    videoStructure: 'Problem-solving/technical task videos, simulations',
    pacing: 'Fast, applied',
    presentationStyle: '"Here\'s the problem, here\'s the fix" style',
    avoid: 'Long theory before application',
    pushStrategy: 'Push an applied challenge immediately after the video',
    pushTrigger: 'on_challenge_submit',
  },
  Accommodating: {
    type: 'Accommodating',
    videoStructure: 'Trial-and-error, hands-on experimentation videos',
    pacing: 'Fast, intuitive',
    presentationStyle: '"Just try it" style, rapid prototyping demos',
    avoid: 'Heavy upfront planning/theory videos',
    pushStrategy: 'Push a "try it now" action prompt before the next video',
    pushTrigger: 'on_video_end',
  },
};

// ---------- Classification (derived, never stored as a locked type) ----------

export function classifyPersonalityType(profile: LearningProfile): PersonalityType {
  const practical = profile.theoryVsPractical < 5;
  const reflective = profile.pace < 5;
  if (practical && reflective) return 'Diverging';
  if (!practical && reflective) return 'Assimilating';
  if (!practical && !reflective) return 'Converging';
  return 'Accommodating';
}

export function getTeachingProcess(profile: LearningProfile): TeachingProcess {
  return TEACHING_PROCESS[classifyPersonalityType(profile)];
}

// ---------- Rolling-window behavioral blend ----------

const ROLLING_WINDOW_SIZE = 15; // last N sessions only — old behavior ages out
const BEHAVIOR_BLEND_WEIGHT = 0.25; // prior stays dominant; behavior nudges gradually

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Silent update — no toast/notification is triggered here by design.
// Caller is responsible for persisting the returned profile (e.g. via
// learningProfileStore.ts's existing save function) exactly like any other
// profile write; this function only computes the new values.
export function updateProfileFromBehavior(
  baseProfile: LearningProfile,
  allSessions: EngagementSession[]
): LearningProfile {
  const windowed = allSessions
    .slice()
    .sort((a, b) => new Date(b.sessionTimestamp).getTime() - new Date(a.sessionTimestamp).getTime())
    .slice(0, ROLLING_WINDOW_SIZE);

  if (windowed.length === 0) return baseProfile;

  // Behavioral pace signal: high completion + low replay/pause friction implies
  // the learner tolerates (or wants) a faster pace than their stated prior.
  const paceSignal = average(
    windowed.map((s) => {
      const completion = clamp(s.watchPercentage / 100, 0, 1);
      const minutesWatched = Math.max(1, s.totalDuration / 60);
      const friction = clamp((s.replayCount + s.pauseCount) / minutesWatched, 0, 1);
      const behavioral10 = (1 - friction) * 10 * completion;
      return behavioral10;
    })
  );

  const blendedPace = baseProfile.pace * (1 - BEHAVIOR_BLEND_WEIGHT) + paceSignal * BEHAVIOR_BLEND_WEIGHT;

  return {
    ...baseProfile,
    pace: clamp(Math.round(blendedPace), 1, 10),
    // theoryVsPractical is left untouched here — a reliable behavioral signal for it
    // needs per-concept theory/practical tagging, which isn't wired yet. Flagging as
    // a follow-up rather than guessing at a proxy.
  };
}

// ---------- Filter-bubble guard ----------

const DIVERSITY_INJECTION_RATE = 0.15; // roughly 1 in ~7 selections

export function shouldInjectDiverseType(): boolean {
  return Math.random() < DIVERSITY_INJECTION_RATE;
}

export function pickDiverseType(current: PersonalityType): PersonalityType {
  const others = (Object.keys(TEACHING_PROCESS) as PersonalityType[]).filter((t) => t !== current);
  return others[Math.floor(Math.random() * others.length)];
}

// Convenience wrapper for PlaylistBuilder.ts's V2 path: returns which
// TeachingProcess to actually target for this selection, applying the
// diversity guard.
export function resolveTeachingProcessForSelection(profile: LearningProfile): TeachingProcess {
  const primaryType = classifyPersonalityType(profile);
  const targetType = shouldInjectDiverseType() ? pickDiverseType(primaryType) : primaryType;
  return TEACHING_PROCESS[targetType];
}
