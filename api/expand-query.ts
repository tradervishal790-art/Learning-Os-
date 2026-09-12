import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';

interface Blueprint {
  role: string;
  goal: string;
  language: string;
  hours: number;
  style: {
    pace: number;
    practical: number;
    depth: number;
    structure: number;
    storytelling: number;
    languageComplexity: number;
  };
}

const QUERY_EXPANSION_PROMPT = (userInput: string, blueprint: Blueprint) => `
User wrote: "${userInput}"

User's Mind Blueprint:
- Role: ${blueprint.role}
- Goal: ${blueprint.goal}
- Language preference: ${blueprint.language}
- Time: ${blueprint.hours} hours/week
- Learning style (each 1-10 scale):
  - Pace (1=ultra-detailed, 10=fast/dense): ${blueprint.style.pace}
  - Practical (1=pure theory, 10=hands-on): ${blueprint.style.practical}
  - Depth (1=surface, 10=deep technical): ${blueprint.style.depth}
  - Structure (1=freeform, 10=stepwise): ${blueprint.style.structure}
  - Storytelling (1=dry, 10=story-driven): ${blueprint.style.storytelling}
  - Language complexity (1=basic, 10=jargon-heavy): ${blueprint.style.languageComplexity}

Give 3-5 SPECIFIC, personalized YouTube search queries that match this exact user's style and goal.

Rules:
- Don't use generic "best"/"top"/"easy" — use specific keywords
- ${blueprint.style.practical >= 7 ? 'Prioritize practical/hands-on content — use "examples", "project", "real-world" keywords' : 'Prioritize theory-focused content — use "derivation", "proof", "explanation" keywords'}
- ${blueprint.style.pace >= 7 ? 'The user prefers a fast pace — also include "in one shot", "complete", "summary" type queries' : 'The user prefers a detailed pace — "step by step", "detailed", "thorough" type queries'}
- ${blueprint.style.storytelling >= 7 ? 'Prefer story/analogy-driven keywords — "story", "real world", "analogy"' : ''}
- ${blueprint.language === 'hindi' ? 'The user has chosen Hindi — add explicit hints in queries for Hindi-spoken videos ("hindi mein samjhaye", "hindi explanation", "hindi medium"); India-context English terms alone (NCERT, board exam) are not enough since they can also return English-audio videos.' : blueprint.language === 'hinglish' ? 'The user has chosen Hinglish — put a "hindi medium" or "hindi mein" style hint in at least one query so Hindi-audio explanation videos also come up; the rest of the queries can use mixed keywords.' : 'The language preference is English — India-specific terms (NCERT, board exam, classes 10-12, IIT-JEE, NEET) are fine if relevant, but do not add Hindi-language hints.'}
- ${blueprint.goal === 'job' ? 'Also include job/interview-relevant queries' : ''}
- ${blueprint.goal === 'mastery' ? 'Include deep/expert-level queries' : ''}
- Auto-detect Indian educational context (NCERT, board exam, classes 10-12, IIT-JEE, NEET) from the input

Use the REAL words that actually appear in YouTube titles as keywords — so relevant videos come back.

Return ONLY valid JSON (no markdown backticks, no extra text):
{
  "queries": ["query1", "query2", "query3"],
  "searchHint": "1-line description"
}
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { userInput, blueprint } = (req.body ?? {}) as { userInput?: string; blueprint?: Blueprint };

  if (!userInput?.trim()) {
    return res.status(400).json({ error: 'userInput required' });
  }
  if (!blueprint) {
    return res.status(400).json({ error: 'blueprint required (user mind profile)' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  try {
    const { text: rawText } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      keyGroup: 'research',
      contents: [{ parts: [{ text: QUERY_EXPANSION_PROMPT(userInput, blueprint) }] }],
      minimaxJsonMode: true,
    });

    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: 'Gemini returned non-JSON', raw: rawText });
    }

    if (!Array.isArray(parsed.queries) || parsed.queries.length === 0) {
      return res.status(502).json({ error: 'No queries returned', raw: parsed });
    }

    return res.status(200).json({
      queries: parsed.queries.slice(0, 5),
      searchHint: parsed.searchHint ?? '',
    });
  } catch (err: any) {
    console.error('Query expansion failed:', err);
    return res.status(500).json({ error: err?.message || 'Query expansion failed' });
  }
}