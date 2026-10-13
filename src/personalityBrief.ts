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

// One small habit a day, from the learner's clear leanings. Each habit is a gentle practice for
// the habit that tends to get in the way for that leaning (a "weak spot"), never a judgement.
const HABITS: Record<Trait, { lower: [string, string]; higher: [string, string] }> = {
  openness: {
    lower: ['Pick one topic and ask "why does this work?" three times.', 'Take one fact you know and try it on a new example.'],
    higher: ['Finish one half-done topic before you open a new one.', 'Write down one idea you are curious about, then park it until your session ends.'],
  },
  conscientiousness: {
    lower: ['Write down ONE thing to finish today and start it for just 10 minutes.', 'Do your hardest topic first, for only 15 minutes.'],
    higher: ['Start before your plan feels perfect: do 10 minutes now, adjust later.', 'Leave 10 minutes of today unplanned and use it for whatever you need.'],
  },
  extraversion: {
    lower: ['Explain one thing you learned to someone in 2 minutes.', 'Ask one person one question about a topic you are stuck on.'],
    higher: ['Do one 20-minute solo block with your phone out of reach.', 'Write your own summary of a topic before you discuss it with anyone.'],
  },
  agreeableness: {
    lower: ['Ask a friend how they would solve a problem you are stuck on.', 'Share one thing you learned today with someone.'],
    higher: ['Check one answer yourself before you ask for help.', 'Write down one point where you disagree, and why.'],
  },
  neuroticism: {
    lower: ['Try one question that is a bit harder than your usual level.', 'Set a short timer and attempt a topic you have been avoiding.'],
    higher: ['Take 3 slow breaths, then start with the easiest question.', 'After a low mark, write one thing it taught you before you move on.'],
  },
};

/** Today's habit for the home screen. Same habit all day; rotates daily. Null when no clear leaning. */
export function buildDailyHabit(profile: PersonalityProfile | null, dayNumber: number): string | null {
  if (!profile?.traits) return null;
  const leanings: { trait: Trait; zone: 'lower' | 'higher' }[] = [];
  for (const trait of Object.keys(HABITS) as Trait[]) {
    const r = profile.traits[trait];
    if (!r || r.unsure || r.zone === 'middle') continue;
    leanings.push({ trait, zone: r.zone });
  }
  if (leanings.length === 0) return null;
  const day = Math.max(0, Math.floor(dayNumber));
  const pick = leanings[day % leanings.length];
  return HABITS[pick.trait][pick.zone][Math.floor(day / leanings.length) % 2];
}
