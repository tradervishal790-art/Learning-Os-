import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// api/generate-roadmap.ts
//
// POST body: UserOnboardingData ({ role, goal, language, hours, deadline })
// Response:  { roadmap: Topic }
//
// Called from App.tsx's handleOnboardingComplete() right after the
// "Generate Blueprint" step — this file was missing, which is why the
// roadmap always fell back to the empty FALLBACK_ROADMAP in roadmapData.ts.
//
// Setup needed: same as api/analyze-video.ts —
//   Add VITE_GEMINI_API_KEY in Vercel Project Settings → Environment
//   Variables (the .env.local value is NOT deployed automatically).
// ============================================================

interface UserOnboardingData {
  role: string;
  goal: string;
  language: string;
  hours: number;
  deadline: string;
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

const ROADMAP_PROMPT = (data: UserOnboardingData) => `
Ek learner ke liye ek personalized, sequential learning roadmap banao, in details ke aadhar par:
- Role: ${data.role}
- Goal: ${data.goal}
- Weekly hours available: ${data.hours}
- Deadline: ${data.deadline}

${languageInstruction(data.language)}

8 se 12 topics do, beginner se advanced order mein, jo is goal ko achieve karne mein directly help karein — generic course list nahi, is specific goal ke liye tailored sequence.

Har topic ke liye "topicKeywords" bhi do — 3 se 6 chhote lowercase keywords/phrases jo is topic se related YouTube video titles mein aam taur par milte hain (video-matching ke liye use honge, isliye realistic aur searchable rakhna).

Sirf JSON return karo, is EXACT shape mein, koi extra text ya markdown backticks nahi:

{
  "title": "roadmap ka overall title",
  "description": "1-2 line description",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "estimatedTime": "jaise '3 months'",
  "topics": [
    {
      "title": "topic title",
      "description": "2-3 lines",
      "estimatedTime": "jaise '1 week'",
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
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