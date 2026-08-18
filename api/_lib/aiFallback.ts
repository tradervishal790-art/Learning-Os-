// api/_lib/aiFallback.ts
//
// Shared engine every api/*.ts Gemini-calling endpoint routes through.
// PRIMARY: Gemini (VITE_GEMINI_API_KEY, existing).
// FALLBACK: MiniMax (MINIMAX_API_KEY, new) — triggered automatically
// whenever Gemini fails for ANY reason: network error, non-2xx response
// (rate limit / quota exhausted / model overloaded / upstream 5xx), or an
// empty response body. Callers don't need to know which provider actually
// answered — they get back { text, provider, finishReason } and keep using
// their own existing JSON-parsing / validation logic unchanged.
//
// Env vars:
//   VITE_GEMINI_API_KEY  — existing, required for the primary path
//   MINIMAX_API_KEY      — NEW, required for the fallback path. If missing,
//                          fallback is skipped and Gemini's own error
//                          surfaces exactly as it did before this file
//                          existed — nothing breaks if you don't set it yet.
//   MINIMAX_MODEL         — optional, defaults to 'MiniMax-M3'
//
// Add MINIMAX_API_KEY in Vercel → Project → Settings → Environment
// Variables (same place VITE_GEMINI_API_KEY already lives).
//
// NOTE ON MINIMAX ENDPOINT DETAILS: base URL, model names, and request
// shape below are based on MiniMax's public OpenAI-compatible docs as of
// Aug 2026 (api.minimax.io, /v1/chat/completions, Bearer auth, OpenAI-style
// messages/choices). MiniMax has several unofficial mirror/reseller sites
// with slightly different examples — if requests start failing, check
// https://platform.minimax.io/docs/api-reference/text-openai-api and your
// MiniMax dashboard for the current base URL and confirm your key's region.

interface GeminiPart {
  text: string;
}
interface GeminiContent {
  role?: string; // 'user' | 'model'
  parts: GeminiPart[];
}

export interface AICallParams {
  geminiApiKey?: string;
  minimaxApiKey?: string;
  geminiModel?: string; // default 'gemini-flash-latest'
  minimaxModel?: string; // default MINIMAX_MODEL env var, else 'MiniMax-M3'
  systemInstruction?: string;
  contents: GeminiContent[];
  /** Passed through to Gemini's generationConfig as-is (thinkingConfig, responseSchema, maxOutputTokens, etc). */
  generationConfig?: Record<string, any>;
  minimaxMaxTokens?: number; // default 4096
  minimaxTemperature?: number; // default 0.7
  /** Set true for endpoints expecting structured JSON back — MiniMax can't
   *  enforce Gemini's responseSchema, so this reinforces "JSON only" in the
   *  prompt itself. Your existing JSON.parse + validation still catches
   *  anything malformed, same as it already does for Gemini's output. */
  minimaxJsonMode?: boolean;
}

export interface AICallResult {
  text: string;
  provider: 'gemini' | 'minimax';
  finishReason: string | null;
}

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
// Pinned instead of 'gemini-flash-latest' — that alias currently points to
// an experimental model with tighter rate limits, which was the likely
// cause of the frequent 503 "overloaded" errors. gemini-3-flash-preview is
// Google's current recommended free-tier default: 10 RPM / 1,500 RPD /
// 250K TPM with NO billing account required. If Google eventually retires
// this specific version, update the string here — MiniMax fallback below
// still covers you in the meantime.
const DEFAULT_MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M3';
const MINIMAX_URL = 'https://api.minimax.io/v1/chat/completions';

/** 429 = rate limit/quota exceeded, 503 = model overloaded, 5xx = upstream
 *  failure, 400 included defensively (e.g. a generationConfig field an
 *  aliased model version doesn't support) — all worth failing over rather
 *  than hard-failing the whole request. */
function shouldFailover(status: number): boolean {
  return status === 429 || status === 503 || status === 400 || status >= 500;
}

async function tryGemini(
  params: AICallParams
): Promise<{ ok: true; text: string; finishReason: string | null } | { ok: false; status: number }> {
  if (!params.geminiApiKey) return { ok: false, status: 0 };
  const model = params.geminiModel || DEFAULT_GEMINI_MODEL;

  const body: Record<string, any> = { contents: params.contents };
  if (params.systemInstruction) {
    body.system_instruction = { parts: [{ text: params.systemInstruction }] };
  }
  if (params.generationConfig) {
    body.generationConfig = params.generationConfig;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.geminiApiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!res.ok) {
      return { ok: false, status: res.status };
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const finishReason: string | null = data?.candidates?.[0]?.finishReason ?? null;

    if (!text.trim()) {
      return { ok: false, status: 200 }; // empty response counts as a failure worth failing over
    }

    return { ok: true, text, finishReason };
  } catch {
    return { ok: false, status: 0 }; // network error
  }
}

function contentsToMinimaxMessages(
  systemInstruction: string | undefined,
  contents: GeminiContent[]
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  for (const c of contents) {
    const text = c.parts.map((p) => p.text).join('\n');
    messages.push({ role: c.role === 'model' ? 'assistant' : 'user', content: text });
  }
  return messages;
}

async function tryMinimax(params: AICallParams): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  if (!params.minimaxApiKey) return { ok: false, status: 0 };
  const model = params.minimaxModel || DEFAULT_MINIMAX_MODEL;
  const messages = contentsToMinimaxMessages(params.systemInstruction, params.contents);

  if (params.minimaxJsonMode && messages.length > 0) {
    const last = messages[messages.length - 1];
    last.content +=
      '\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown code fences, no extra text before or after the JSON.';
  }

  try {
    const res = await fetch(MINIMAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.minimaxApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: params.minimaxMaxTokens ?? 4096,
        temperature: params.minimaxTemperature ?? 0.7,
        // Non-thinking, direct answer — matches Gemini's default behavior
        // for these structured/short-turnaround tasks.
        thinking: { type: 'disabled' },
      }),
    });

    if (!res.ok) return { ok: false, status: res.status };

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) return { ok: false, status: 200 };

    return { ok: true, text };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Tries Gemini first. On any failure — network error, non-2xx (rate limit,
 * quota exhausted, overloaded, upstream error), or empty response —
 * automatically retries the same prompt against MiniMax if MINIMAX_API_KEY
 * is configured. Throws only if both providers fail (or Gemini fails and no
 * MiniMax key exists); callers catch this exactly like their existing
 * try/catch already does.
 */
export async function generateAIText(params: AICallParams): Promise<AICallResult> {
  const geminiResult = await tryGemini(params);
  if (geminiResult.ok) {
    return { text: geminiResult.text, provider: 'gemini', finishReason: geminiResult.finishReason };
  }

  if (!shouldFailover(geminiResult.status) && geminiResult.status !== 0) {
    // A genuinely non-retriable Gemini error (e.g. 401 invalid key on our
    // own side) — still worth trying MiniMax rather than giving up, since
    // it's a completely separate credential/provider.
  }

  const minimaxResult = await tryMinimax(params);
  if (minimaxResult.ok) {
    return { text: minimaxResult.text, provider: 'minimax', finishReason: null };
  }

  const reason = params.minimaxApiKey
    ? `Gemini failed (status ${geminiResult.status}) and MiniMax fallback also failed (status ${minimaxResult.status})`
    : `Gemini failed (status ${geminiResult.status}) and no MINIMAX_API_KEY configured for fallback`;
  const err = new Error(reason) as Error & { geminiStatus: number; minimaxStatus: number };
  err.geminiStatus = geminiResult.status;
  err.minimaxStatus = minimaxResult.status;
  throw err;
}