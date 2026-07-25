import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// api/generate-roadmap.ts
//
// POST body: { role, goal, language, hours, deadline } (UserOnboardingData)
// Response:  { roadmap: Topic }
//
// Mirrors the pattern in api/analyze-video.ts:
// - Gemini REST API called directly (no SDK)
// - VITE_GEMINI_API_KEY read server-side
// - Markdown fences stripped before JSON.parse
// ============================================================

interface UserOnboardingData {
  role: string;
  goal: string;
  language: string;
  hours: number;
  deadline: string;
}

const ROADMAP_PROMPT = (data: UserOnboardingData) => `
You are generating a personalized learning roadmap for a user of an app called Learning OS.

User profile:
- Role: ${data.role}
- Goal: ${data.goal}
- Preferred language: ${data.language}
- Hours available per week: ${data.hours}
- Deadline: ${data.deadline}

Generate a learning roadmap as a single JSON object matching EXACTLY this shape (a "Topic"):

{
  "id": string (kebab-case, unique),
  "title": string,
  "description": string,
  "status": "learning",
  "estimatedTime": string (e.g. "8-12 weeks"),
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "why": {
    "learn": string (why this topic matters, 1-2 sentences),
    "connect": string (how it connects to other topics, 1-2 sentences),
    "system": string (what larger system/field this belongs to, 1 sentence),
    "risk": string (what happens if the user skips it, 1 sentence)
  },
  "children": [
    {
      "id": string (kebab-case, unique),
      "title": string,
      "description": string,
      "status": "locked",
      "estimatedTime": string,
      "difficulty": "Beginner" | "Intermediate" | "Advanced",
      "why": { "learn": string, "connect": string, "system": string, "risk": string },
      "topicKeywords": string[] (3-5 short lowercase keywords or phrases likely to appear in YouTube video titles about this exact topic)
    }
  ]
}

Rules:
- Generate between 6 and 10 children topics, ordered from foundational to advanced, tailored to the user's role, goal, hours, and deadline.
- Write titles/descriptions in ${data.language} if it is not English, otherwise English.
- Return ONLY the JSON object, no extra text, no markdown code fences.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as Partial<UserOnboardingData>;
  const { role, goal, language, hours, deadline } = body;

  if (!role || !goal || !language || hours === undefined || !deadline) {
    res.status(400).json({ error: 'role, goal, language, hours, and deadline are all required' });
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
          contents: [{ parts: [{ text: ROADMAP_PROMPT({ role, goal, language, hours, deadline }) }] }],
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

    let roadmap: any;
    try {
      roadmap = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'Gemini returned non-JSON response', raw: rawText });
      return;
    }

    if (!roadmap || typeof roadmap !== 'object' || !Array.isArray(roadmap.children)) {
      res.status(502).json({ error: 'Gemini response did not match the expected Topic shape', raw: roadmap });
      return;
    }

    // Safety net: enforce the initial-status rule server-side rather than trusting
    // the model to have followed it — there's no real progress yet at generation time.
    roadmap.status = 'learning';
    roadmap.children = roadmap.children.map((child: any, i: number) => ({
      ...child,
      status: i === 0 ? 'learning' : 'locked',
    }));

    res.status(200).json({ roadmap });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate roadmap' });
  }
}