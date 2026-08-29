// api/research.ts
//
// Server-side proxy for the standalone Research page (Research.tsx).
// Uses Gemini's built-in Google Search grounding tool — the browser only
// ever sends the query, never the Gemini key.
//
// NOTE: this does NOT go through _lib/aiFallback.ts. That shared engine
// doesn't pass a `tools` param, and MiniMax has no equivalent live-search
// grounding — failing over to it would silently turn "research" into a
// plain (possibly stale) knowledge-only answer with zero sources. Instead:
// try Gemini+grounding, and only on failure fall back to an explicitly
// labeled non-grounded answer (still via MiniMax if configured) so the
// UI can tell the user "no live sources" instead of pretending otherwise.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';

interface ResearchSource {
  title: string;
  url: string;
}

const RESEARCH_MODEL = 'gemini-3-flash-preview'; // same pinned default as aiFallback.ts

async function groundedGeminiSearch(
  query: string,
  apiKey: string
): Promise<{ summary: string; sources: ResearchSource[] } | null> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: query }] }],
    system_instruction: {
      parts: [
        {
          text:
            'Aap ek research assistant hain. User ke query ka current, factual, well-organized summary do (Hinglish mein, natural tone). ' +
            'Bullet points aur short paragraphs use karein. Bold important terms. 200-350 words. ' +
            'Sirf apni knowledge se mat likho — search results ko ground truth maano.',
        },
      ],
    },
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${RESEARCH_MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const summary: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  if (!summary.trim()) return null;

  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const c of chunks) {
    const uri = c?.web?.uri;
    const title = c?.web?.title;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ title: title || uri, url: uri });
  }

  return { summary, sources };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { query } = (req.body ?? {}) as { query?: string };
  if (!query?.trim()) {
    return res.status(400).json({ error: 'query required' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  // Primary: Gemini with live Google Search grounding.
  if (apiKey) {
    try {
      const grounded = await groundedGeminiSearch(query, apiKey);
      if (grounded) {
        return res.status(200).json({ ...grounded, grounded: true });
      }
    } catch (err) {
      console.error('Grounded research call failed, falling back:', err);
    }
  }

  // Fallback: no live search, plain knowledge-based answer, clearly flagged.
  try {
    const { text } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      systemInstruction:
        'Aap ek research assistant hain. Hinglish mein, 200-300 words ka clear summary do. Bullet points use karein.',
      contents: [{ parts: [{ text: query }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    });
    return res.status(200).json({ summary: text, sources: [], grounded: false });
  } catch (err: any) {
    console.error('Research proxy failed completely:', err);
    return res.status(500).json({ error: err?.message || 'Research request failed' });
  }
}
