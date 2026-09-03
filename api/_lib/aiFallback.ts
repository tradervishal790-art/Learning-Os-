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
  text?: string;
  // ── Added for video-taste analysis (api/analyze-taste-video.ts) ────────
  // A YouTube URL passed as fileData — Gemini fetches the video itself
  // server-side, no download/yt-dlp/ffmpeg needed on our end. videoMetadata
  // trims it to a specific clip (e.g. startOffset:'0s', endOffset:'45s')
  // so we only pay for/process a few short clips per video, not the full
  // 45+ min. See: https://ai.google.dev/gemini-api/docs/video-understanding
  fileData?: { fileUri: string; mimeType: string };
  videoMetadata?: { startOffset: string; endOffset: string; fps?: number };
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
  /** Which Gemini key pool this call draws from — keeps a heavy feature
   *  from starving a lighter one's quota. Default 'notes' if omitted.
   *    'notes'    — generate-notes, generate-roadmap, mentor-chat,
   *                 blueprint-interview, deep-dive-extract, analyze-video,
   *                 analyze-taste-video (heavier, gets more keys)
   *    'research' — research, expand-query (lighter, gets its own key so
   *                 heavy notes/transcript usage never blocks it) */
  keyGroup?: 'notes' | 'research';
}

export interface AICallResult {
  text: string;
  provider: 'gemini' | 'minimax';
  finishReason: string | null;
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';
// Switched from 'gemini-3.8-flash' (Sept 2026) — 3.8 was returning 503
// "overloaded" errors in production, likely tighter serving capacity as a
// freshly-released model. 3.7 Flash is the previous-generation Flash
// model, same free-tier pricing, more established/stable capacity. If
// this starts 503ing too, check https://aistudio.google.com/rate-limit
// for the model dropdown's current peak-usage numbers before switching
// again — MiniMax fallback below still covers you in the meantime
// (assuming MINIMAX_API_KEY has an active balance — see note below).
const DEFAULT_MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M3';
const MINIMAX_URL = 'https://api.minimax.io/v1/chat/completions';

// ── Multi-key Gemini rotation, split by feature group ────────────────────
// The whole point of Gemini's free tier (see DEFAULT_GEMINI_MODEL comment
// above) is 5 RPM / 20 RPD / ~290K TPM PER KEY (verified in AI Studio's
// own dashboard — RPD is the real bottleneck, far tighter than TPM).
// Instead of hitting that
// ceiling and immediately falling over to MiniMax, rotate through a pool of
// keys — each from a separate Google account, so each has its OWN
// independent free quota. MiniMax is still the final fallback if every
// Gemini key in a group's pool is exhausted/failing.
//
// Split into two groups so a heavy feature (Notes, which now sends up to
// 150K chars of transcript) can never starve a lighter one (Research) of
// quota, and vice versa:
//   'notes'    — generate-notes, generate-roadmap, mentor-chat,
//                blueprint-interview, deep-dive-extract, analyze-video,
//                analyze-taste-video. Gets 2 keys (heavier group).
//     VITE_GEMINI_API_KEY  — primary (existing)
//     GEMINI_API_KEY_2     — backup
//   'research' — research, expand-query. Gets its own dedicated key.
//     GEMINI_API_KEY_3     — dedicated to this group
//
// The caller's own geminiApiKey param (whatever it read from
// VITE_GEMINI_API_KEY itself) is always appended as a last-resort safety
// net — so if a group's dedicated env vars aren't set yet, it still has
// at least one key to try instead of going straight to MiniMax.
function getGeminiKeyPool(group: 'notes' | 'research', callerKey: string | undefined): string[] {
  const keys =
    group === 'research'
      ? [process.env.GEMINI_API_KEY_3, callerKey]
      : [process.env.VITE_GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, callerKey];
  const cleaned = keys.filter((k): k is string => !!k && k.trim().length > 0);
  // Dedup in case the same key ended up in two env vars/params.
  return Array.from(new Set(cleaned));
}

async function tryGemini(
  apiKey: string,
  params: AICallParams
): Promise<{ ok: true; text: string; finishReason: string | null } | { ok: false; status: number }> {
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
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
    // Only text parts carry over — fileData (video) parts have no `text`
    // and are silently dropped here (see hasVideoParts() below, which
    // stops generateAIText from ever routing a video request to MiniMax
    // in the first place, so this filter is a defensive no-op in practice).
    const text = c.parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join('\n');
    messages.push({ role: c.role === 'model' ? 'assistant' : 'user', content: text });
  }
  return messages;
}

/** MiniMax's chat-completions API is text-only — it cannot accept the
 *  fileData/videoMetadata parts used for video-taste analysis. Detect
 *  those up front so generateAIText can skip the MiniMax attempt entirely
 *  instead of silently sending it a request stripped of its actual content. */
function hasVideoParts(contents: GeminiContent[]): boolean {
  return contents.some((c) => c.parts.some((p) => !!p.fileData));
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
  const group = params.keyGroup ?? 'notes';
  const geminiKeys = getGeminiKeyPool(group, params.geminiApiKey);
  console.log(`[aiFallback] group=${group} key pool size: ${geminiKeys.length}`);

  // Last failure status across the key pool — a plain number instead of
  // holding onto the { ok, ... } union, since TS can't narrow that union
  // back to the ok:false branch after a loop that reassigns it.
  let lastGeminiStatus = 0;

  // Try each key in the pool in order. A failure on one key (rate limit,
  // overload, whatever) says nothing about the NEXT key — it's a
  // completely separate account/quota — so keep going through the whole
  // pool before giving up on Gemini entirely.
  for (let i = 0; i < geminiKeys.length; i++) {
    const result = await tryGemini(geminiKeys[i], params);
    if (result.ok) {
      console.log(`[aiFallback] Gemini key #${i + 1}/${geminiKeys.length} succeeded`);
      return { text: result.text, provider: 'gemini', finishReason: result.finishReason };
    }
    console.warn(`[aiFallback] Gemini key #${i + 1}/${geminiKeys.length} failed (status ${result.status}) — trying next`);
    lastGeminiStatus = result.status;
  }

  if (hasVideoParts(params.contents)) {
    // Don't call tryMinimax at all — it would silently drop the video and
    // either return a hallucinated answer or an unhelpful empty-content
    // error. Fail clearly instead so the caller falls back to its own
    // non-video path (e.g. transcript/metadata-only analysis).
    const err = new Error(
      `Gemini failed (status ${lastGeminiStatus}) and MiniMax cannot process video content — no fallback available for this request`
    ) as Error & { geminiStatus: number; minimaxStatus: number };
    err.geminiStatus = lastGeminiStatus;
    err.minimaxStatus = 0;
    throw err;
  }

  const minimaxResult = await tryMinimax(params);
  if (minimaxResult.ok) {
    console.log('[aiFallback] All Gemini keys failed — MiniMax fallback succeeded');
    return { text: minimaxResult.text, provider: 'minimax', finishReason: null };
  }

  const reason = params.minimaxApiKey
    ? `Gemini failed (status ${lastGeminiStatus}) and MiniMax fallback also failed (status ${minimaxResult.status})`
    : `Gemini failed (status ${lastGeminiStatus}) and no MINIMAX_API_KEY configured for fallback`;
  const err = new Error(reason) as Error & { geminiStatus: number; minimaxStatus: number };
  err.geminiStatus = lastGeminiStatus;
  err.minimaxStatus = minimaxResult.status;
  throw err;
}