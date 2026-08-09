import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// api/generate-roadmap.ts
//
// POST body: UserOnboardingData ({ role, goal, language, hours, deadline })
//            + optional learningProfile (Mind Map / quiz result)
// Response:  { roadmap: Topic }
//
// FIX (this version):
// 1. Total available hours ab SERVER-SIDE calculate hote hain (hours/week x
//    weeks-in-deadline) — Gemini ko sirf raw hours/deadline text nahi diya
//    jaata, balki ek EXPLICIT target topic-count aur per-topic time-budget
//    bataya jaata hai. Isse chapters properly granular sub-topics mein
//    todte hain instead of "1 chapter = 1 flat topic" (jo one-shot-video
//    problem ka root cause tha).
// 2. learningProfile (Mind Map se) ab optional param hai — agar mile to
//    prompt mein use hota hai taaki roadmap ki depth/style bhi learner ke
//    hisaab se ho, sirf video-selection stage tak limited na rahe.
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
  deadline: string;   // 'none' | '1m' | '3m' | '6m' | '1y'
  learningProfile?: LearningProfileInput;
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
  if (normalized === 'hindi') return 'Sab kuch Hindi (Devanagari) mein likho.';
  if (normalized === 'hinglish') return 'Sab kuch Hinglish (Hindi-English mix, jaise students aapas mein baat karte hain) mein likho.';
  return 'Write everything in clear English.';
}

// ---- Deadline -> days (same buckets used across the UI / PlaylistBuilder.ts) ----
const DEADLINE_DAYS: Record<string, number> = {
  none: 90, // no deadline chosen -> assume a reasonable default (~3 months) so we still get a sane topic count
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

/** Total study hours available across the whole deadline window. */
function calculateTotalHours(hoursPerWeek: number, deadline: string): number {
  const days = DEADLINE_DAYS[deadline] ?? DEADLINE_DAYS.none;
  const weeks = days / 7;
  return Math.round(weeks * hoursPerWeek);
}

/**
 * Turns total hours into an explicit target: how many topics, and how many
 * hours each topic should roughly take. This is the key fix — instead of
 * Gemini guessing "8-12 topics" blindly, it gets a concrete budget derived
 * from the user's actual time commitment.
 *
 * Rough heuristic: a single focused sub-topic (one concept, one sitting)
 * should take 1-2.5 hours of study including video + practice. We pick a
 * per-topic hour target based on total hours available, then derive count.
 */
function calculateTopicBudget(totalHours: number): { topicCount: number; hoursPerTopic: number } {
  let hoursPerTopic: number;
  if (totalHours < 20) hoursPerTopic = 1;        // very tight — keep topics small & fast
  else if (totalHours < 60) hoursPerTopic = 1.5;
  else if (totalHours < 150) hoursPerTopic = 2;
  else hoursPerTopic = 2.5;                       // plenty of time — can go deeper per topic

  let topicCount = Math.round(totalHours / hoursPerTopic);
  topicCount = Math.max(6, Math.min(20, topicCount)); // keep it sane — not 2 topics, not 60

  return { topicCount, hoursPerTopic };
}

function learningStyleInstruction(profile?: LearningProfileInput): string {
  if (!profile) return '';

  const lines: string[] = [];
  if (profile.pace >= 7) {
    lines.push('User fast pace prefer karta hai — topics thode zyada granular/bite-sized rakho, taaki fast-moving content match ho.');
  } else if (profile.pace <= 4) {
    lines.push('User detailed/slow pace prefer karta hai — topics thoda zyada foundational rakho, kuch topics mein basics ko explicitly cover karo.');
  }
  if (profile.theoryVsPractical >= 7) {
    lines.push('User hands-on/practical learner hai — jahan possible ho, topics ko practical/project-oriented framing do (sirf theory list na ho).');
  } else if (profile.theoryVsPractical <= 4) {
    lines.push('User theory-first learner hai — concepts ko conceptual/foundational order mein rakho, practical application baad mein.');
  }
  if (profile.depth >= 7) {
    lines.push('User deep/technical understanding chahta hai — topics mein depth avoid mat karo, surface-level list mat banao.');
  }
  if (profile.structureNeed >= 7) {
    lines.push('User ko clear step-by-step structure chahiye — topics strictly sequential aur dependency-aware order mein rakho.');
  }

  return lines.length > 0 ? `\nUser ka learning style (Mind Map se):\n- ${lines.join('\n- ')}` : '';
}

const ROADMAP_PROMPT = (data: UserOnboardingData) => {
  const totalHours = calculateTotalHours(data.hours, data.deadline);
  const { topicCount, hoursPerTopic } = calculateTopicBudget(totalHours);

  return `
Ek learner ke liye ek personalized, sequential learning roadmap banao, in details ke aadhar par:
- Role: ${data.role}
- Goal: ${data.goal}
- Weekly hours available: ${data.hours}
- Deadline: ${data.deadline}
- Total study hours available (calculated): ~${totalHours} hours over this deadline
${learningStyleInstruction(data.learningProfile)}

${languageInstruction(data.language)}

IMPORTANT — topic granularity (time-budget based):
Is learner ke paas total ~${totalHours} hours hain. Har topic learner ke liye roughly ${hoursPerTopic} hours ka honा chahiye (video watching + practice included) — na usse kaafi zyada, na kaafi kam.
Isliye ~${topicCount} topics do — yeh sirf ek generic range nahi hai, yeh directly is learner ke time-budget se calculate hua hai.

CRITICAL: agar goal ek bada chapter/subject cover karta hai (jaise "Class 12 Physics Chapter 1" ya "React seekhna"), to usse ek hi flat topic mat banao — usko is learner ke time-budget ke hisaab se multiple granular sub-topics mein todo (jaise "Electric Charges" → "Charge properties" + "Coulomb's Law" + "Superposition Principle" + "Electric Field" + "Electric Dipole" — agar ${topicCount} topics ka budget allow karta hai). Har sub-topic itna specific ho ki ek single, focused video/session mein cover ho sake — "poora chapter ek video mein" type broad topic mat banao.

Topics beginner se advanced order mein hone chahiye, jo is goal ko achieve karne mein directly help karein — generic course list nahi, is specific goal ke liye tailored sequence.

Har topic ke liye "topicKeywords" bhi do — 3 se 6 chhote lowercase keywords/phrases jo is topic se related YouTube video titles mein aam taur par milte hain (video-matching ke liye use honge, isliye realistic aur searchable rakhna — aur is granular sub-topic ke liye specific hon, poore chapter ke liye generic nahi).

Sirf JSON return karo, is EXACT shape mein, koi extra text ya markdown backticks nahi:

{
  "title": "roadmap ka overall title",
  "description": "1-2 line description",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "estimatedTime": "jaise '3 months'",
  "topics": [
    {
      "title": "topic title (specific, granular sub-topic — not a whole chapter)",
      "description": "2-3 lines",
      "estimatedTime": "jaise '${hoursPerTopic} hours' ya '1 week'",
      "difficulty": "Beginner" | "Intermediate" | "Advanced",
      "topicKeywords": ["keyword1", "keyword2"],
      "why": {
        "learn": "yeh kyun seekhna chahiye",
        "connect": "yeh baaki topics/system se kaise connect hota hai",
        "system": "yeh kis bade system/domain ka hissa hai",
        "risk": "agar nahi seekha to kya risk hai"
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
    res.status(400).json({ error: 'Onboarding data incomplete — role, goal, language, hours, deadline sab chahiye' });
    return;
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Gemini API key not configured on server (VITE_GEMINI_API_KEY missing)' });
    return;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: ROADMAP_PROMPT(data as UserOnboardingData) }] }],
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      res.status(502).json({ error: 'Gemini API error', detail: geminiData });
      return;
    }

    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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