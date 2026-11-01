// api/_lib/mentorHistory.ts
//
// Normalizes untrusted client history for Gemini. The current user message
// is appended exactly once; only real user/mentor turns are accepted.

export interface HistoryMessage {
  role: 'user' | 'mentor';
  content: string;
}

interface Content {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const MAX_HISTORY = 6;
const MAX_MESSAGE_CHARS = 4000;

/** Keep only valid, bounded turns so malformed roles cannot become model instructions. */
export function sanitizeMentorHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((message): message is { role: string; content: string } =>
      !!message
      && typeof message === 'object'
      && ((message as { role?: unknown }).role === 'user' || (message as { role?: unknown }).role === 'mentor')
      && typeof (message as { content?: unknown }).content === 'string'
    )
    .map((message) => ({
      role: message.role as HistoryMessage['role'],
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-MAX_HISTORY);
}

export function buildMentorContents(
  history: unknown,
  userMessage: string
): Content[] {
  const current = userMessage.trim().slice(0, MAX_MESSAGE_CHARS);
  let prior = sanitizeMentorHistory(history);
  while (prior.length > 0 && prior[0].role !== 'user') {
    prior = prior.slice(1);
  }
  const last = prior[prior.length - 1];
  const withoutDuplicate = last?.role === 'user' && last.content === current
    ? prior.slice(0, -1)
    : prior;

  const contents: Content[] = [];
  for (const m of [...withoutDuplicate, { role: 'user' as const, content: current }]) {
    const role = m.role === 'user' ? 'user' : 'model';
    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text += `\\n\\n${m.content}`;
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }
  return contents;
}
