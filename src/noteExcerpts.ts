// ============================================================
// noteExcerpts.ts — what "Ask my notes" sends when a note is longer than the per-source limit.
// It used to send only the FIRST 6000 characters, so an answer that sat on page 12 was never seen.
// Now the passages that share the most words with the question are kept (in their original order).
// ============================================================

/** Words of the question that are worth matching (3+ letters, any script). */
export function questionWords(question: string): string[] {
  return [...new Set(question.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length >= 3))];
}

/** Lines grouped into passages of up to ~`size` characters. */
function chunk(text: string, size: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // a single very long line is cut so one chunk never exceeds the whole budget
    for (let i = 0; i < line.length; i += size) {
      const piece = line.slice(i, i + size);
      if (cur && cur.length + piece.length + 1 > size) {
        out.push(cur);
        cur = piece;
      } else {
        cur = cur ? `${cur}\n${piece}` : piece;
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** The text itself when it fits; otherwise the best-matching passages (the start of the note when nothing matches). */
export function pickExcerpts(text: string, words: string[], max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const chunks = chunk(t, 400);
  const scored = chunks.map((c, i) => {
    const lower = c.toLowerCase();
    return { c, i, s: words.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0) };
  });
  if (!scored.some((x) => x.s > 0)) return t.slice(0, max);
  const picked: typeof scored = [];
  let used = 0;
  for (const x of [...scored].sort((a, b) => b.s - a.s || a.i - b.i)) {
    if (x.s === 0) break;
    if (used + x.c.length + 1 > max) continue;
    picked.push(x);
    used += x.c.length + 1;
  }
  // keep the beginning (title / context) when there is room left
  if (!picked.some((x) => x.i === 0) && used + scored[0].c.length + 1 <= max) picked.push(scored[0]);
  picked.sort((a, b) => a.i - b.i);
  return picked.map((x) => x.c).join('\n');
}
