import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';

// ============================================================
// api/generate-roadmap.ts
//
// POST body: UserOnboardingData ({ role, goal, language, hours, deadline })
//            + optional learningProfile (Mind Map / quiz result)
// Response:  { roadmap: Topic }
//
// FIX HISTORY:
// 1. Total available hours are now calculated SERVER-SIDE (hours/week x
//    weeks-in-deadline) — Gemini is given an explicit target topic count
//    and a per-topic time budget, so chapters break into granular
//    sub-topics (not one flat topic per chapter).
// 2. learningProfile (Mind Map) is an optional param — when present it's
//    used in the prompt so the roadmap's depth/style can also match the
//    learner.
// 3. FOUNDATION-FIRST SEQUENCING: after the granularity fix, a new issue
//    showed up — the roadmap would jump straight to advanced/specific
//    sub-topics (like "Gauss's Law derivation") without covering basic
//    concepts (like "what is charge") first. The prompt now explicitly
//    enforces that every new chapter/subject starts with foundational
//    topics (definitions/intro concepts), then properties/rules, then
//    advanced laws/derivations/applications — it should never start
//    directly with an advanced topic.
// ============================================================

interface LearningProfileInput {
  pace: number;                 // 1-10
  theoryVsPractical: number;    // 1-10
  depth: number;                // 1-10
  structureNeed: number;        // 1-10
  languageComplexity: number;   // 1-10
  storytelling: number;         // 1-10
  repetitionNeed: number;       // 1-10
}

interface UserOnboardingData {
  role: string;
  goal: string;
  language: string;
  hours: number;      // hours/week
  deadline: string;   // 'none' | '1m' | '3m' | '6m' | '1y' | free-text label
  /** Exact deadline in days from the Day/Week/Month slider — takes
   *  priority over the coarse `deadline` string bucket when present. */
  deadlineDays?: number;
  learningProfile?: LearningProfileInput;
  /** Optional exam/board (e.g. "CBSE Class 10", "JEE", "NEET") — when set,
   *  the prompt asks for syllabus-ordered, weightage-aware topics instead
   *  of a generic best-effort sequence. See examInstruction() below. */
  examType?: string;
}

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
const VALID_DIFFICULTIES: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

function normalizeDifficulty(value: unknown): Difficulty {
  if (typeof value === 'string') {
    const match = VALID_DIFFICULTIES.find((d) => d.toLowerCase() === value.toLowerCase());
    if (match) return match;
  }
  return 'Beginner';
}

function languageInstruction(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized === 'hindi') return 'Write everything in Hindi (Devanagari script).';
  if (normalized === 'hinglish') return 'Write everything in Hinglish (a Hindi-English mix, like how students talk to each other).';
  return 'Write everything in clear English.';
}

/** When the goal is tied to a specific exam/board, the roadmap should follow
 *  THAT syllabus's structure and prioritize by marks-weightage — not just a
 *  generic "logical order for the subject" sequence. Empty when no exam is set. */
function examInstruction(examType?: string): string {
  const trimmed = examType?.trim();
  if (!trimmed) return '';
  return `
EXAM MODE — this learner's goal is to specifically prepare for "${trimmed}", not generic self-study:
- The topic order should follow that exam's official/standard syllabus sequence, not just a "logical" order for the subject — if the two differ, prioritize the syllabus order.
- Also give an "examWeightage" field for each topic — "high" if this topic typically carries more marks/questions in that exam, "medium" or "low" if less. This tells the learner what to prioritize under time pressure.
- Don't take any topic beyond the syllabus (no off-syllabus depth) unless the learner has explicitly asked for that.`;
}

// ---- Deadline -> days (same buckets used across the UI / PlaylistBuilder.ts) ----
const DEADLINE_DAYS: Record<string, number> = {
  none: 90, // no deadline chosen -> assume a reasonable default (~3 months) so we still get a sane topic count
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

/** Total study hours available across the whole deadline window.
 *  `deadlineDays`, when provided (from the Day/Week/Month slider), takes
 *  priority — it's an exact day count instead of a coarse 5-bucket preset. */
function calculateTotalHours(hoursPerWeek: number, deadline: string, deadlineDays?: number): number {
  const days = deadlineDays && deadlineDays > 0 ? deadlineDays : (DEADLINE_DAYS[deadline] ?? DEADLINE_DAYS.none);
  const weeks = days / 7;
  return Math.round(weeks * hoursPerWeek);
}

/**
 * Turns total hours into an explicit target: how many topics, and how many
 * hours each topic should roughly take.
 */
function calculateTopicBudget(totalHours: number): { topicCount: number; hoursPerTopic: number } {
  let hoursPerTopic: number;
  if (totalHours < 20) hoursPerTopic = 1;
  else if (totalHours < 60) hoursPerTopic = 1.5;
  else if (totalHours < 150) hoursPerTopic = 2;
  else hoursPerTopic = 2.5;

  let topicCount = Math.round(totalHours / hoursPerTopic);
  topicCount = Math.max(6, Math.min(20, topicCount));

  return { topicCount, hoursPerTopic };
}

function learningStyleInstruction(profile?: LearningProfileInput): string {
  if (!profile) return '';

  const lines: string[] = [];
  if (profile.pace >= 7) {
    lines.push('The user prefers a fast pace — keep topics a bit more granular/bite-sized to match fast-moving content.');
  } else if (profile.pace <= 4) {
    lines.push('The user prefers a detailed/slow pace — keep topics a bit more foundational, explicitly covering the basics in some topics.');
  }
  if (profile.theoryVsPractical >= 7) {
    lines.push('The user is a hands-on/practical learner — wherever possible, frame topics practically/project-oriented (not just a theory list).');
  } else if (profile.theoryVsPractical <= 4) {
    lines.push('The user is a theory-first learner — keep concepts in a conceptual/foundational order, with practical application later.');
  }
  if (profile.depth >= 7) {
    lines.push("The user wants deep/technical understanding — don't avoid depth in topics, don't make a surface-level list.");
  }
  if (profile.structureNeed >= 7) {
    lines.push('The user needs a clear step-by-step structure — keep topics in a strictly sequential, dependency-aware order.');
  }

  return lines.length > 0 ? `\nThe user's learning style (from the Mind Map):\n- ${lines.join('\n- ')}` : '';
}

const ROADMAP_PROMPT = (data: UserOnboardingData) => {
  const totalHours = calculateTotalHours(data.hours, data.deadline, data.deadlineDays);
  const { topicCount, hoursPerTopic } = calculateTopicBudget(totalHours);

  return `
Create a personalized, sequential learning roadmap for a learner, based on these details:
- Role: ${data.role}
- Subject/Topic to learn: ${data.goal}
- Weekly hours available: ${data.hours}
- Deadline: ${data.deadline}
- Total study hours available (calculated): ~${totalHours} hours over this deadline
${learningStyleInstruction(data.learningProfile)}

${languageInstruction(data.language)}
${examInstruction(data.examType)}

IMPORTANT — topic granularity (time-budget based):
This learner has a total of ~${totalHours} hours. Each topic should take roughly ${hoursPerTopic} hours for the learner (video watching + practice included) — not much more, not much less.
So give ~${topicCount} topics — this isn't just a generic range, it's calculated directly from this learner's time budget.

CRITICAL: if the goal covers a large chapter/subject (like a whole subject or a whole chapter), don't make it a single flat topic — break it into multiple granular sub-topics based on this learner's time budget. Each sub-topic should be specific enough to be covered in a single, focused video/session — don't make a broad topic like "a whole chapter in one video".

CRITICAL — FOUNDATION-FIRST SEQUENCING (how to achieve this):
BEFORE writing the topics, write a short "prerequisiteChain" — think clearly in 3-6 lines: "what concept is essential to know first to understand this goal/chapter? what comes after that? and after that?" — like a dependency chain. Only write the topics array once this chain is clear, and the topic order should follow EXACTLY this chain.

Always follow this pattern in the chain: first basic definitions/core concept introduction, then basic properties/rules (statement + simple application), then connecting/related concepts, and only at the end advanced laws/derivations/applications.

WRONG: starting topics directly with "Gauss's Law — Derivation", while "what is electric charge" or "Coulomb's Law" hasn't been covered in the chain yet.
RIGHT: "Electric Charge — Properties & Types" -> "Coulomb's Law — Statement & Application" -> "Electric Field — Concept & Field Lines" -> "Electric Dipole" -> "Gauss's Law — Statement & Derivation" -> "Gauss's Law — Applications".

Prioritize this rule over time-budget granularity — if hours are limited, make topics smaller/fewer, but never break the prerequisite chain, never skip the foundation of any topic.

Topics should be in beginner-to-advanced order, directly helping to achieve this goal — not a generic course list, a sequence tailored to this specific goal.

Also give "topicKeywords" for each topic — 3 to 6 short lowercase keywords/phrases commonly found in YouTube video titles related to this topic (these will be used for video-matching, so keep them realistic and searchable — and specific to this granular sub-topic, not generic to the whole chapter).

Return only JSON, in this EXACT shape, no extra text or markdown backticks:

{
  "title": "overall title of the roadmap",
  "description": "1-2 line description",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "estimatedTime": "e.g. '3 months'",
  "prerequisiteChain": "3-6 lines of prerequisite reasoning — which concept first, which after, and why (the topics array will follow this exact order)",
  "topics": [
    {
      "title": "topic title (specific, granular sub-topic — not a whole chapter)",
      "description": "2-3 lines",
      "estimatedTime": "e.g. '${hoursPerTopic} hours' or '1 week'",
      "difficulty": "Beginner" | "Intermediate" | "Advanced",
      "topicKeywords": ["keyword1", "keyword2"],${data.examType?.trim() ? `\n      "examWeightage": "high" | "medium" | "low",` : ''}
      "why": {
        "learn": "why this should be learned",
        "connect": "how this connects to other topics/the system",
        "system": "what larger system/domain this is part of",
        "risk": "what's the risk if this isn't learned"
      }
    }
  ]
}
`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const data = (req.body ?? {}) as Partial<UserOnboardingData>;
  if (!data.role || !data.goal || !data.language || !data.hours || !data.deadline) {
    res.status(400).json({ error: 'Onboarding data incomplete — role, goal, language, hours, and deadline are all required' });
    return;
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
    return;
  }

  try {
    const promptText = ROADMAP_PROMPT(data as UserOnboardingData);

    const { text: rawText } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ parts: [{ text: promptText }] }],
      // Thinking enabled on Gemini — model reasons through the prerequisite
      // chain/sequencing before writing the final JSON, rather than jumping
      // straight to output. -1 = dynamic budget, model decides how much to
      // think based on request complexity. MiniMax (fallback) ignores this
      // field — it gets a plain non-thinking call via aiFallback.ts.
      generationConfig: { thinkingConfig: { thinkingBudget: -1 } },
      minimaxJsonMode: true,
      minimaxMaxTokens: 8000,
    });

    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'Gemini returned non-JSON response', raw: rawText });
      return;
    }

    if (!Array.isArray(parsed?.topics) || parsed.topics.length === 0) {
      res.status(502).json({ error: 'Gemini response missing a valid topics array', raw: parsed });
      return;
    }

    // Assemble the actual Topic tree the rest of the app expects (matches types.ts).
    // First topic starts as 'learning' (current), rest 'locked' — matches
    // getCurrentTopic()'s expectation of exactly one 'learning' topic at a time.
    const children = parsed.topics.map((t: any, i: number) => ({
      id: `topic-${i + 1}-${Date.now()}`,
      title: typeof t.title === 'string' ? t.title : `Topic ${i + 1}`,
      description: typeof t.description === 'string' ? t.description : '',
      status: i === 0 ? ('learning' as const) : ('locked' as const),
      estimatedTime: typeof t.estimatedTime === 'string' ? t.estimatedTime : '—',
      difficulty: normalizeDifficulty(t.difficulty),
      why: {
        learn: typeof t.why?.learn === 'string' ? t.why.learn : '',
        connect: typeof t.why?.connect === 'string' ? t.why.connect : '',
        system: typeof t.why?.system === 'string' ? t.why.system : '',
        risk: typeof t.why?.risk === 'string' ? t.why.risk : '',
      },
      topicKeywords: Array.isArray(t.topicKeywords)
        ? t.topicKeywords.filter((k: unknown) => typeof k === 'string').map((k: string) => k.toLowerCase())
        : [],
      ...(t.examWeightage === 'high' || t.examWeightage === 'medium' || t.examWeightage === 'low'
        ? { examWeightage: t.examWeightage }
        : {}),
    }));

    const roadmap = {
      id: 'roadmap-root',
      title: typeof parsed.title === 'string' ? parsed.title : 'Your Learning Roadmap',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      status: 'locked' as const, // root itself is never rendered as a clickable topic
      estimatedTime: typeof parsed.estimatedTime === 'string' ? parsed.estimatedTime : '—',
      difficulty: normalizeDifficulty(parsed.difficulty),
      why: { learn: '', connect: '', system: '', risk: '' },
      children,
    };

    res.status(200).json({ roadmap });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate roadmap' });
  }
}
