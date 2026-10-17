import { authFetch } from './apiFetch';
import type { NoteAiErrorCode, NoteAiRequest, NoteAiResult } from './noteAiTypes';

const ENDPOINT = '/api/extract-questions?op=note-ai';
const DEFAULT_TIMEOUT_MS = 45_000;
const KINDS: readonly string[] = [
  'text', 'extract', 'flashcards', 'quiz', 'questions', 'issues', 'conceptMap', 'answer',
];

export class NoteAiError extends Error {
  code: NoteAiErrorCode;
  status?: number;

  constructor(code: NoteAiErrorCode, message?: string, status?: number) {
    super(message ?? code);
    Object.setPrototypeOf(this, NoteAiError.prototype);
    this.name = 'NoteAiError';
    this.code = code;
    this.status = status;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isAbortError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    (e as { name: unknown }).name === 'AbortError'
  );
}

function codeForStatus(status: number, body: unknown): NoteAiErrorCode {
  if (status === 413) return 'too-large';
  if (status === 429) return 'rate-limited';
  if (status === 403 && isRecord(body) && body.code === 'account-required') return 'account-required';
  if (status === 502) return 'bad-reply';
  if (status >= 500) return 'unavailable';
  if (status === 400) return 'bad-request';
  return 'unavailable';
}

export async function runNoteAi(
  req: NoteAiRequest,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<NoteAiResult> {
  const callerSignal = opts?.signal;
  if (callerSignal?.aborted) throw new NoteAiError('aborted', 'Cancelled.');

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const res = await authFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    let data: unknown = null;
    try {
      data = await res.json();
    } catch (e) {
      if (isAbortError(e)) throw e;
      data = null; // empty or non-JSON body; status decides
    }

    if (!res.ok) {
      const message = isRecord(data) && typeof data.error === 'string' ? data.error : undefined;
      throw new NoteAiError(codeForStatus(res.status, data), message, res.status);
    }

    if (!isRecord(data) || typeof data.kind !== 'string' || !KINDS.includes(data.kind)) {
      throw new NoteAiError('bad-reply', 'Unexpected reply shape.', res.status);
    }
    return data as NoteAiResult;
  } catch (e) {
    if (e instanceof NoteAiError) throw e;
    if (isAbortError(e)) {
      if (callerSignal?.aborted) throw new NoteAiError('aborted', 'Cancelled.');
      if (timedOut) throw new NoteAiError('network', 'Request timed out.');
      throw new NoteAiError('aborted', 'Cancelled.');
    }
    throw new NoteAiError('network', e instanceof Error ? e.message : 'Network error.');
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}
