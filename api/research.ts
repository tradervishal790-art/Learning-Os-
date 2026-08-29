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

// Written to kill every "obviously AI" tell in the output — this is what
// makes the page usable as an actual research aid instead of reading like
// a chatbot disclaimer wrapped around a Wikipedia summary.
const HUMAN_RESEARCH_STYLE = `Tum ek insaan ho jisne abhi is topic pe khud internet khangaal ke padha hai, aur apne kisi dost/colleague ko seedha bata rahe ho jo samajhna chahta hai. Hinglish mein likho, natural bolchaal wali tone mein — jaise koi likha hua notes nahi, seedha samjha raha ho.

Sakht mana hai:
- "Based on my research", "I hope this helps", "In conclusion", "Certainly!", "Great question", "As we can see", "It's important to note that", "Overall" jaise koi bhi AI-typical opener/closer/filler phrase — inn sab ko poori tarah avoid karo
- Robotic intro jaise "Yahaan hai ek summary" ya "Is topic ke baare mein" — seedha content se shuru karo
- Har point ko alag bullet mein todna jab wo ek hi flow ka hissa ho — jahan natural lage wahi bullet use karo, baaki normal paragraphs mein likho jaise baat kar rahe ho
- Generic hedging ("it depends", "there are many factors") bina kisi specific fact ke — agar hedge karna hai to WHY bhi batao
- Formal closing summary ya "Let me know if" jaisa kuch mat jodo

Karna hai:
- Seedha point pe aao, pehli line se hi kuch concrete batao
- Specific facts, numbers, naam, dates jo search mein mile wahi use karo — vague mat raho
- Jahan koi cheez interesting ya surprising lage, wahan wahi natural reaction dikhao jaise koi insaan dikhata (bina overdo kiye)
- 200-350 words, lekin fixed structure follow mat karo — jo topic maange wahi likho`;

async function groundedGeminiSearch(
  query: string,
  apiKey: string
): Promise<{ summary: string; sources: ResearchSource[] } | null> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: query }] }],
    system_instruction: {
      parts: [{ text: HUMAN_RESEARCH_STYLE }],
    },
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.75, maxOutputTokens: 2048 },
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
      systemInstruction: HUMAN_RESEARCH_STYLE,
      contents: [{ parts: [{ text: query }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    });
    return res.status(200).json({ summary: text, sources: [], grounded: false });
  } catch (err: any) {
    console.error('Research proxy failed completely:', err);
    return res.status(500).json({ error: err?.message || 'Research request failed' });
  }
}
