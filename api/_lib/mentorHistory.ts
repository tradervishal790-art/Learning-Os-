// api/_lib/mentorHistory.ts
//
// Builds the `contents` array for the mentor chat call. Gemini expects
// the conversation to start with a user turn and to alternate roles, so
// this normalises whatever the client sent instead of trusting it:
//   - a trailing copy of the current user message is dropped (older
//     clients sent the new message both inside `history` and as
//     `userMessage`, so the model saw it twice)
//   - leading mentor/model turns (the canned welcome message) are dropped
//   - consecutive same-role turns are merged
// The current user message is always appended last.

export interface HistoryMessage {
  role: 'user' | 'mentor';
  content: string;
}

interface Content {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const MAX_HISTORY = 6;

export function buildMentorContents(
  history: HistoryMessage[] | undefined,
  userMessage: string
): Content[] {
  const current = userMessage.trim();

  let prior = (history ?? []).filter(
    (m) => m && typeof m.content === 'string' && m.content.trim()
  );

  const last = prior[prior.length - 1];
  if (last && last.role === 'user' && last.content.trim() === current) {
    prior = prior.slice(0, -1);
  }

  prior = prior.slice(-MAX_HISTORY);
  while (prior.length > 0 && prior[0].role !== 'user') {
    prior = prior.slice(1);
  }

  const contents: Content[] = [];
  for (const m of [...prior, { role: 'user' as const, content: current }]) {
    const role = m.role === 'user' ? 'user' : 'model';
    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text += `\n\n${m.content}`;
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }
  return contents;
}
