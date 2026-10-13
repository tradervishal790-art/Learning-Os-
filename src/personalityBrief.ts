// ============================================================
// personalityBrief.ts  ("learner brief", Step 0 of using the Personality Check everywhere)
//
// Turns the Personality Check result into a few short, plain study directives, computed
// ON THE DEVICE. Only these coarse lines ever leave the device for other AI features
// (Mentor first). The report text, archetype, raw scores and answers are never sent
// (see docs/RULES.md: the detailed profile stays private to the learner).
//
// Only clear leanings produce a line. Middle zones and "unsure" areas are skipped,
// so a weak or mixed result never gets turned into a wrong personalisation.
// ============================================================

import type { PersonalityProfile } from './personalityScoring';
import type { Trait } from './personalityQuestions';

const DIRECTIVES: Record<Trait, { lower: string; higher: string }> = {
  openness: {
    lower: 'prefers practical, step-by-step examples over abstract ideas',
    higher: 'enjoys the why behind things; a short analogy or big-picture view works well',
  },
  conscientiousness: {
    lower: 'works best with small, near-term steps; avoid long plans',
    higher: 'likes clear structure; a short checklist or plan works well',
  },
  extraversion: {
    lower: 'prefers quiet, solo study; do not push group study',
    higher: 'learns by talking things through; invite them to explain it back',
  },
  agreeableness: {
    lower: 'independent; give direct answers without extra padding',
    higher: 'responds well to encouragement and a collaborative tone',
  },
  neuroticism: {
    lower: 'steady under pressure; can be challenged directly',
    higher: 'can feel pressure strongly; keep a calm, reassuring tone and break work into small steps',
  },
};

/** Up to 5 short directives (one per clearly-leaning area). Empty when there is no usable result. */
export function buildPersonalityBrief(profile: PersonalityProfile | null): string[] {
  if (!profile?.traits) return [];
  const out: string[] = [];
  for (const trait of Object.keys(DIRECTIVES) as Trait[]) {
    const r = profile.traits[trait];
    if (!r || r.unsure || r.zone === 'middle') continue;
    out.push(DIRECTIVES[trait][r.zone]);
  }
  return out;
}

export type PlanTip = 'small' | 'calm' | 'talk' | 'checklist';

/** ONE short tip for the Study Plan screen (which has no AI). First clear leaning wins; null when none. */
export function buildPlanTip(profile: PersonalityProfile | null): PlanTip | null {
  if (!profile?.traits) return null;
  const clear = (t: Trait, zone: 'lower' | 'higher') => {
    const r = profile.traits[t];
    return !!r && !r.unsure && r.zone === zone;
  };
  if (clear('neuroticism', 'higher')) return 'calm';
  if (clear('conscientiousness', 'lower')) return 'small';
  if (clear('extraversion', 'higher')) return 'talk';
  if (clear('conscientiousness', 'higher')) return 'checklist';
  return null;
}
