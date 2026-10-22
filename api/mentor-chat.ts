// api/mentor-chat.ts
//
// Server-side proxy for the AI Mentor chat (Mentor.tsx). The system
// prompt + Gemini call used to live entirely in the browser with
// `import.meta.env.VITE_GEMINI_API_KEY` in the fetch URL — exposed in
// the client bundle. Moved server-side; the browser now only sends the
// conversation content, never the key.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/auth.js';
import { generateAIText } from './_lib/aiFallback.js';
import { buildMentorContents, type HistoryMessage } from './_lib/mentorHistory.js';
import { formatStudentContext } from './_lib/mentorPrompt.js';
import { MENTOR_UI_PROMPT } from './_lib/mentorUiPrompt.js';
import { extractProgram, looksLikeProgram, validateProgram } from './_lib/mentorUiCheck.js';

type Locale = 'en' | 'hi' | 'hinglish';

function languageInstruction(locale: Locale): string {
  if (locale === 'hi') return 'Hindi (Devanagari script)';
  if (locale === 'en') return 'English';
  return 'Hinglish (Hindi written in Roman script, mixed with English)';
}

// The rules are written in English on purpose: a Hinglish prompt leaked Hinglish words into
// English replies. The reply language is set by one explicit line.
const buildSystemInstructions = (topic: string, locale: Locale) => `You are a patient, expert AI learning mentor for students in India.

Reply language: ${languageInstruction(locale)} only. Do not mix in words from other languages.
${topic ? `The student's most recently watched video (may be unrelated to this question — mention it only if it helps): ${topic}` : ''}

Tone:
- Address the student respectfully (in Hindi/Hinglish use "aap", never "tu/tum").
- Warm, encouraging, never condescending. If they are wrong, correct gently without judging.

Format:
- Maximum 120 words unless the student asks for detail. Finish every sentence.
- Short lines. At most 4 bullets or steps. Use **bold** only for key terms. No headings.
- Explain with one simple real-world analogy when it helps.
- End with one clear next step.

Scope and safety:
- You are a study mentor. You cannot open links, play or embed videos, or browse the web, so never claim to, and never invent video titles, links or channel names.
- Never tell the student to bypass a ban or restriction (VPN, region change, APK from third-party sites). Say briefly that the app is not officially available there and suggest legal alternatives that work in India, or help with the underlying skill instead.
- If the question is not about learning, answer in two lines and steer back to their study goal.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await requireUser(req, res);
  if (!uid) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { userMessage, context, history, studentContext, locale: rawLocale, richUi } = (req.body ?? {}) as {
    userMessage?: string;
    context?: string;
    history?: HistoryMessage[];
    studentContext?: unknown;
    locale?: string;
    richUi?: boolean;
  };

  if (!userMessage?.trim()) {
    return res.status(400).json({ error: 'userMessage required' });
  }
  const locale: Locale = rawLocale === 'hi' || rawLocale === 'en' ? rawLocale : 'hinglish';

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    return res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
  }

  const topic = typeof context === 'string' ? context.slice(0, 120) : '';
  const contents = buildMentorContents(history, userMessage);

  // Visual cards (OpenUI Lang) are opt-in per request; MENTOR_RICH_UI_OFF=1 on the server is a kill switch.
  const wantCards = richUi === true && process.env.MENTOR_RICH_UI_OFF !== '1';
  const baseInstruction = buildSystemInstructions(topic, locale) + formatStudentContext(studentContext);
  const callModel = (withCards: boolean) =>
    generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      systemInstruction: withCards ? `${baseInstruction}\n\n${MENTOR_UI_PROMPT}` : baseInstruction,
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    });

  try {
    let { text, finishReason } = await callModel(wantCards);
    let ui = false;

    if (wantCards && looksLikeProgram(text)) {
      const program = extractProgram(text);
      if (finishReason !== 'MAX_TOKENS' && validateProgram(program).ok) {
        text = program;
        ui = true;
      } else {
        // The model tried cards but the program is broken or cut off: ask once more for plain text
        // rather than showing code. (Only happens when cards were attempted and failed.)
        ({ text, finishReason } = await callModel(false));
      }
    }

    return res.status(200).json({ text, finishReason: finishReason ?? null, ui });
  } catch (err: any) {
    console.error('Mentor chat proxy failed:', err);
    return res.status(500).json({ error: 'Something went wrong (both Gemini and MiniMax failed). Please try again in a bit. 🔄' });
  }
}