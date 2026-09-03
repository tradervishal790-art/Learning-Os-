// api/research.ts
//
// Server-side proxy for the Research page (Research.tsx) and the
// parallel-with-video research panel (VideoIntel.tsx). Uses Gemini's
// built-in Google Search grounding tool — the browser only ever sends
// the query, never the Gemini key.
//
// OUTPUT SHAPE: a list of {title, url, snippet} results, same shape as a
// Google results page (title + link + snippet), not one AI essay. The
// snippet for each result is built from the actual grounded text segments
// Gemini attributed to that specific source (groundingSupports), not a
// separate made-up description — so it stays tied to real search data.
//
// NOTE: this does NOT go through _lib/aiFallback.ts. That shared engine
// doesn't pass a `tools` param, and MiniMax has no equivalent live-search
// grounding — failing over to it would silently turn "research" into a
// plain (possibly stale) knowledge-only answer with zero sources. Instead:
// try Gemini+grounding, and only on failure fall back to a single
// explicitly-labeled non-grounded result so the UI can tell the user
// "no live sources" instead of pretending otherwise.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback.js';

interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
}

const RESEARCH_MODEL = 'gemini-3-flash-preview'; // same pinned default as aiFallback.ts
const SNIPPET_MAX_LEN = 240;

// Written to kill every "obviously AI" tell in the underlying generated
// text — even though the UI now shows it broken up as short snippets
// instead of one essay, this still keeps each snippet reading like a real
// sentence a person wrote, not chatbot filler.
const HUMAN_RESEARCH_STYLE = `Tum ek insaan ho jisne abhi is topic pe khud internet khangaal ke padha hai, aur apne kisi dost/colleague ko seedha bata rahe ho jo samajhna chahta hai. Hinglish mein likho, natural bolchaal wali tone mein — jaise koi likha hua notes nahi, seedha samjha raha ho.

Sakht mana hai:
- "Based on my research", "I hope this helps", "In conclusion", "Certainly!", "Great question", "As we can see", "It's important to note that", "Overall" jaise koi bhi AI-typical opener/closer/filler phrase — inn sab ko poori tarah avoid karo
- Robotic intro jaise "Yahaan hai ek summary" ya "Is topic ke baare mein" — seedha content se shuru karo
- Generic hedging ("it depends", "there are many factors") bina kisi specific fact ke — agar hedge karna hai to WHY bhi batao

Karna hai:
- Seedha point pe aao, pehli line se hi kuch concrete batao
- Specific facts, numbers, naam, dates jo search mein mile wahi use karo — vague mat raho
- Short, clear sentences likho — har sentence apne aap mein ek complete fact ho, kyunki inhe alag-alag snippets mein todha jayega
- 250-400 words total`;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

async function groundedGeminiSearch(query: string, apiKey: string): Promise<ResearchResult[] | null> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: query }] }],
    system_instruction: { parts: [{ text: HUMAN_RESEARCH_STYLE }] },
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.75, maxOutputTokens: 2048 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${RESEARCH_MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const fullText: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  if (!fullText.trim()) return null;

  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const supports = data?.candidates?.[0]?.groundingMetadata?.groundingSupports ?? [];
  if (chunks.length === 0) return null;

  // For each source chunk, collect the actual generated sentences that
  // were grounded in it (via groundingSupports' chunk-index mapping) —
  // this is the closest real equivalent to a Google result snippet we can
  // build without a separate page-scrape.
  const snippetsByChunk = new Map<number, string[]>();
  for (const support of supports) {
    const text: string | undefined = support?.segment?.text;
    const indices: number[] = support?.groundingChunkIndices ?? [];
    if (!text) continue;
    for (const idx of indices) {
      if (!snippetsByChunk.has(idx)) snippetsByChunk.set(idx, []);
      snippetsByChunk.get(idx)!.push(text.trim());
    }
  }

  const seen = new Set<string>();
  const results: ResearchResult[] = [];
  chunks.forEach((c: any, idx: number) => {
    const uri = c?.web?.uri;
    const title = c?.web?.title;
    if (!uri || seen.has(uri)) return;
    seen.add(uri);

    const ownSentences = snippetsByChunk.get(idx) ?? [];
    const snippet = ownSentences.length > 0 ? truncate(ownSentences.join(' '), SNIPPET_MAX_LEN) : '';

    results.push({ title: title || uri, url: uri, snippet });
  });

  // A handful of sources sometimes end up with no directly-mapped
  // sentence (the model paraphrased across sources). Backfill their
  // snippet from the overall answer so no result card renders empty.
  const fallbackSnippet = truncate(fullText, SNIPPET_MAX_LEN);
  for (const r of results) {
    if (!r.snippet) r.snippet = fallbackSnippet;
  }

  return results.length > 0 ? results : null;
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
      const results = await groundedGeminiSearch(query, apiKey);
      if (results) {
        return res.status(200).json({ results, grounded: true });
      }
    } catch (err) {
      console.error('Grounded research call failed, falling back:', err);
    }
  }

  // Fallback: no live search results — one clearly-labeled result card
  // instead of a fake results list.
  try {
    const { text } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      keyGroup: 'research',
      systemInstruction: HUMAN_RESEARCH_STYLE,
      contents: [{ parts: [{ text: query }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    });
    return res.status(200).json({
      results: [{ title: 'Live source nahi mila', url: '', snippet: text.trim() }],
      grounded: false,
    });
  } catch (err: any) {
    console.error('Research proxy failed completely:', err);
    return res.status(500).json({ error: err?.message || 'Research request failed' });
  }
}
