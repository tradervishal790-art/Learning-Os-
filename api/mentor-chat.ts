// api/mentor-chat.ts
//
// Server-side proxy for the AI Mentor chat (Mentor.tsx). The system
// prompt + Gemini call used to live entirely in the browser with
// `import.meta.env.VITE_GEMINI_API_KEY` in the fetch URL — exposed in
// the client bundle. Moved server-side; the browser now only sends the
// conversation content, never the key.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_MODEL = 'gemini-flash-latest';

interface HistoryMessage {
  role: 'user' | 'mentor';
  content: string;
}

const buildSystemInstructions = (topic: string) => `Aap ek expert AI Mentor hain jo Hinglish (Hindi + English mix) mein sikhaate hain.
Current topic: ${topic}

Tone & Respect Rules:
- User ko hamesha "aap" se address karein, "tu/tum" kabhi use na karein
- Polite, encouraging aur patient tone rakhein — kabhi condescending ya dismissive na lagein
- Agar user galti kare, gently correct karein bina judge kiye
- Har response mein user ke effort ko acknowledge karein jab appropriate ho

Content Rules:
- Hinglish mein naturally jawab dein, robotic mat lagein
- Concepts ko real-world analogies se samjhaayein
- Bold important terms
- Response concise rakhein (max 150-200 words) — lekin jo bhi likhein, use POORA complete karein, adhoori sentence mein mat chhodein
- Emojis use karein but overdo na karein
- End mein ek clear next step suggest karein`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { userMessage, context, history } = (req.body ?? {}) as {
    userMessage?: string;
    context?: string;
    history?: HistoryMessage[];
  };

  if (!userMessage?.trim()) {
    return res.status(400).json({ error: 'userMessage required' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  const topic = context || 'general learning';
  const contents = [
    ...(history ?? []).slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemInstructions(topic) }] },
          contents,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({
        error: `Kuch gadbad ho gayi API call mein (${geminiRes.status}: ${errBody?.error?.message || 'unknown'}). Thodi der mein phir try karein. 🔄`,
      });
    }

    const data = await geminiRes.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(502).json({ error: 'Response nahi mil paaya, phir se try karein. 🔄' });
    }

    return res.status(200).json({ text, finishReason: finishReason ?? null });
  } catch (err: any) {
    console.error('Mentor chat proxy failed:', err);
    return res.status(500).json({ error: 'Network error aaya. Internet check karein aur phir try karein. 🔄' });
  }
}
