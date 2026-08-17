// api/deep-dive-extract.ts
//
// Server-side proxy for the Deep Dive Chat's Gemini extraction call
// (DeepDiveChat.tsx). The prompt itself (built by deepDiveScoring.ts's
// buildExtractionPrompt) is not sensitive — it's just template text —
// so the client still builds it and sends it here. What matters is that
// the Gemini API key never travels to the browser; this endpoint is the
// only place that holds it.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIText } from './_lib/aiFallback';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { prompt } = (req.body ?? {}) as { prompt?: string };
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt required' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  try {
    const { text } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
      minimaxMaxTokens: 500,
      minimaxTemperature: 0.4,
    });

    return res.status(200).json({ text });
  } catch (err: any) {
    console.error('Deep dive extract proxy failed:', err);
    return res.status(500).json({ error: err?.message || 'Deep dive extraction failed' });
  }
}