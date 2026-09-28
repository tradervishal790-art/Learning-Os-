// ============================================================
// mentorContext.ts
//
// Builds the compact "who is this student" snapshot that Mentor.tsx
// sends to /api/mentor-chat, so the mentor adapts to the learner instead
// of answering like a generic chatbot.
//
// Deliberately NOT sent: the Blueprint Interview narrative
// (blueprintReport) and raw trait numbers. Docs/RULES.md treats the full
// profile detail as password-gated, so the mentor only gets derived,
// coarse teaching directives (from personalityEngine's TeachingProcess)
// plus a few plain-language flags.
//
// The profile is a *prior*, never a fixed label (MEMORY.md) — this is
// recomputed on every message from the current stores, so rolling
// behavior updates flow through automatically.
// ============================================================

import { getLearningProfile } from './learningProfileStore';
import { getTeachingProcess } from './personalityEngine';
import { getSavedGoals, getActiveGoals } from './goalsStore';
import { getRoadmapData, getCurrentTopic } from './roadmapData';
import { getMasteryHeatmap, getWeakAreas } from './progressData';

export interface MentorStudentContext {
  teaching?: {
    pacing: string;
    presentationStyle: string;
    avoid: string;
    needs: string[];
  };
  goals?: { title: string; exam?: string; deadline?: string }[];
  currentTopic?: string;
  weakTopics?: { title: string; mastery: number }[];
}

function level(n: number, low: string, high: string): string | null {
  if (n >= 7) return high;
  if (n <= 3) return low;
  return null;
}

function buildTeaching(): MentorStudentContext['teaching'] | undefined {
  const profile = getLearningProfile();
  if (!profile) return undefined;
  // A quiz the learner gamed or skipped tells us nothing reliable —
  // better no personalization than a wrong one.
  if (profile.selfReportedHonesty === 'gamed' || profile.selfReportedHonesty === 'declined') {
    return undefined;
  }

  const process = getTeachingProcess(profile);
  const needs = [
    level(profile.languageComplexity, 'prefers very simple language', 'comfortable with technical language'),
    level(profile.repetitionNeed, 'little repetition needed', 'benefits from repetition and recap'),
    level(profile.priorKnowledgeComfort, 'assume no prior knowledge, start from basics', 'can skip basics'),
    level(profile.storytelling, 'prefers direct explanations over stories', 'learns well from stories and analogies'),
    level(profile.structureNeed, 'fine with loose structure', 'wants clear step-by-step structure'),
  ].filter((x): x is string => x !== null);

  return {
    pacing: process.pacing,
    presentationStyle: process.presentationStyle,
    avoid: process.avoid,
    needs,
  };
}

export function buildMentorStudentContext(): MentorStudentContext {
  const ctx: MentorStudentContext = {};

  try {
    ctx.teaching = buildTeaching();
  } catch {
    // Profile unreadable — mentor still works, just unpersonalized.
  }

  try {
    const goals = getSavedGoals();
    const active = getActiveGoals(goals);
    if (active.length > 0) {
      ctx.goals = active.map((g) => ({
        title: g.title,
        exam: g.examType || undefined,
        deadline: g.deadline || undefined,
      }));
    }

    // Current topic: first active goal that has one in progress.
    const roadmaps = active.length > 0 ? active.map((g) => getRoadmapData(g.id)) : [getRoadmapData()];
    for (const r of roadmaps) {
      const t = getCurrentTopic(r);
      if (t) {
        ctx.currentTopic = t.title;
        break;
      }
    }

    const weak = getWeakAreas(getMasteryHeatmap(goals), 3);
    if (weak.length > 0) {
      ctx.weakTopics = weak.map((w) => ({ title: w.title, mastery: w.masteryScore }));
    }
  } catch {
    // Missing/corrupt goal or roadmap data — skip that part.
  }

  return ctx;
}
