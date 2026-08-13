// api/deep-dive-extract.ts
//
// Server-side proxy for the Deep Dive Chat's Gemini extraction call
// (DeepDiveChat.tsx). The prompt itself (built by deepDiveScoring.ts's
// buildExtractionPrompt) is not sensitive — it's just template text —
// so the client still builds it and sends it here. What matters is that
// the Gemini API key never travels to the browser; this endpoint is the
// only place that holds it.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_MODEL = 'gemini-flash-latest';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { prompt } = (req.body ?? {}) as { prompt?: string };
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt required' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({ error: `Gemini error ${geminiRes.status}` });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: 'Empty Gemini response' });
    }

    return res.status(200).json({ text });
  } catch (err: any) {
    console.error('Deep dive extract proxy failed:', err);
    return res.status(500).json({ error: err?.message || 'Deep dive extraction failed' });
  }
}
