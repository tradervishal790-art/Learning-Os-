import type { TestQuestion } from './types';

/** Normalize question wording for duplicate detection across scans/import batches. */
export function normalizeQuestionText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/^\s*(?:(?:question|ques|q)\s*)?\d+\s*[.)\-:、．]\s*/i, '')
    .replace(/[’‘'"“”]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function questionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Avoid fuzzy matches on short stems; common short questions can be distinct.
  if (Math.min(a.length, b.length) < 35) return 0;
  const aa = new Set(a.split(' ').filter((w) => w.length > 1));
  const bb = new Set(b.split(' ').filter((w) => w.length > 1));
  if (Math.min(aa.size, bb.size) < 6) return 0;
  let overlap = 0;
  aa.forEach((word) => { if (bb.has(word)) overlap++; });
  return overlap / (aa.size + bb.size - overlap);
}

/** Returns unique questions in input order and how many repeated stems were skipped. */
export function dedupeQuestions<T extends Pick<TestQuestion, 'type' | 'question'>>(questions: T[]): { questions: T[]; duplicates: number } {
  const kept: T[] = [];
  const normalized: string[] = [];
  let duplicates = 0;
  for (const q of questions) {
    const text = normalizeQuestionText(q.question);
    const duplicate = kept.some((prior, i) =>
      prior.type === q.type && (normalized[i] === text || questionSimilarity(normalized[i], text) >= 0.9)
    );
    if (duplicate) {
      duplicates++;
      continue;
    }
    kept.push(q);
    normalized.push(text);
  }
  return { questions: kept, duplicates };
}
