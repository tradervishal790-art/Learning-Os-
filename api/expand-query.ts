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
User ne likha: "${userInput}"

User ka Mind Blueprint:
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

YouTube search ke liye 3-5 SPECIFIC personalized queries do jo is exact user ke style aur goal se match karein.

Rules:
- Generic "best"/"top"/"easy" mat use kar — specific keywords use kar
- ${blueprint.style.practical >= 7 ? 'Practical/hands-on content prioritize kar — "examples", "project", "real-world" keywords use kar' : 'Theory-focused content prioritize kar — "derivation", "proof", "explanation" keywords use kar'}
- ${blueprint.style.pace >= 7 ? 'User fast pace prefer karta hai — "in one shot", "complete", "summary" type queries bhi include kar' : 'User detailed pace prefer karta hai — "step by step", "detailed", "thorough" type queries'}
- ${blueprint.style.storytelling >= 7 ? 'Story/analogy-driven keywords prefer kar — "story", "real world", "analogy"' : ''}
- ${blueprint.language === 'hindi' ? 'User ne Hindi language choose ki hai — queries mein explicitly Hindi-spoken video ke liye hints daal ("hindi mein samjhaye", "hindi explanation", "hindi medium"), sirf India-context English terms (NCERT, board exam) kaafi nahi hain kyunki wo English-audio videos bhi la sakte hain.' : blueprint.language === 'hinglish' ? 'User ne Hinglish choose ki hai — kam se kam ek query mein "hindi medium" ya "hindi mein" jaisa hint daalo taaki Hindi-audio explanation wale videos bhi aayein, baaki queries mixed keywords use kar sakti hain.' : 'Language preference English hai — India-specific terms (NCERT, board exam, classes 10-12, IIT-JEE, NEET) chahiye to theek hai, lekin Hindi-language hints mat daalo.'}
- ${blueprint.goal === 'job' ? 'Job/interview-relevant queries bhi include kar' : ''}
- ${blueprint.goal === 'mastery' ? 'Deep/expert-level queries include kar' : ''}
- Indian educational context (NCERT, board exam, classes 10-12, IIT-JEE, NEET) auto-detect kar from input

YouTube titles mein jo REAL words use hote hain wahi keywords use kar — taaki relevant videos return hon.

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