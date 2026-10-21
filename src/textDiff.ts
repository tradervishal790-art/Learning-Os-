// src/textDiff.ts  (pure)
import type { NotePage } from './notebookStore';

export type DiffOp = { type: 'same' | 'add' | 'remove'; text: string };

export interface PageChange {
  pageId: string;
  kind: 'added' | 'removed' | 'changed' | 'same';
  words?: DiffOp[];
  inkBefore: number;
  inkAfter: number;
}

const MAX_WORDS = 5000;
/** DP table limit (Uint16 cells, ~32 MB). Larger middles fall back to the line diff. */
const MAX_CELLS = 16_000_000;

interface Token {
  key: string;
  raw: string;
}
interface Edit {
  type: 'same' | 'add' | 'remove';
  ai: number;
  bi: number;
}

/** Each token is a word plus its trailing whitespace, so ops can be concatenated back into text. */
function tokenizeWords(text: string): Token[] {
  return (text.match(/\S+\s*/g) ?? []).map((raw) => ({ raw, key: raw.trim() }));
}

function tokenizeLines(text: string): Token[] {
  return (text.match(/[^\n]*\n|[^\n]+/g) ?? []).map((raw) => ({ raw, key: raw.replace(/\s+$/, '') }));
}

/** LCS edit script. Common prefix/suffix are trimmed first. Returns null when the DP table would be too big. */
function computeEdits(a: Token[], b: Token[]): Edit[] | null {
  const n0 = a.length;
  const m0 = b.length;
  let lo = 0;
  while (lo < n0 && lo < m0 && a[lo].key === b[lo].key) lo++;
  let hiA = n0;
  let hiB = m0;
  while (hiA > lo && hiB > lo && a[hiA - 1].key === b[hiB - 1].key) {
    hiA--;
    hiB--;
  }
  const n = hiA - lo;
  const m = hiB - lo;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;

  const edits: Edit[] = [];
  for (let i = 0; i < lo; i++) edits.push({ type: 'same', ai: i, bi: i });

  if (n === 0 || m === 0) {
    for (let i = 0; i < n; i++) edits.push({ type: 'remove', ai: lo + i, bi: -1 });
    for (let j = 0; j < m; j++) edits.push({ type: 'add', ai: -1, bi: lo + j });
  } else {
    const w = m + 1;
    const dp = new Uint16Array((n + 1) * w); // LCS length of suffixes; min(n, m) <= 4000 here, so no overflow
    for (let i = n - 1; i >= 0; i--) {
      const ka = a[lo + i].key;
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] =
          ka === b[lo + j].key
            ? dp[(i + 1) * w + j + 1] + 1
            : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[lo + i].key === b[lo + j].key) {
        edits.push({ type: 'same', ai: lo + i, bi: lo + j });
        i++;
        j++;
      } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
        edits.push({ type: 'remove', ai: lo + i, bi: -1 });
        i++;
      } else {
        edits.push({ type: 'add', ai: -1, bi: lo + j });
        j++;
      }
    }
    while (i < n) edits.push({ type: 'remove', ai: lo + i++, bi: -1 });
    while (j < m) edits.push({ type: 'add', ai: -1, bi: lo + j++ });
  }

  for (let k = 0; k < n0 - hiA; k++) edits.push({ type: 'same', ai: hiA + k, bi: hiB + k });
  return edits;
}

function pushOp(ops: DiffOp[], type: DiffOp['type'], text: string): void {
  if (!text) return;
  const last = ops[ops.length - 1];
  if (last && last.type === type) last.text += text;
  else ops.push({ type, text });
}

function buildOps(edits: Edit[], a: Token[], b: Token[]): DiffOp[] {
  const ops: DiffOp[] = [];
  let removed = '';
  let added = '';
  const flush = (): void => {
    pushOp(ops, 'remove', removed); // inside a changed run: all removals, then all additions
    pushOp(ops, 'add', added);
    removed = '';
    added = '';
  };
  for (const e of edits) {
    if (e.type === 'same') {
      flush();
      pushOp(ops, 'same', b[e.bi].raw);
    } else if (e.type === 'remove') {
      removed += a[e.ai].raw;
    } else {
      added += b[e.bi].raw;
    }
  }
  flush();
  return ops;
}

/**
 * Word-level diff (LCS). Leading whitespace is not preserved.
 * Inputs above 5000 words (or too large for the DP table) fall back to a line-level diff;
 * as a last resort the result is one remove + one add. Never hangs.
 */
export function diffWords(a: string, b: string): DiffOp[] {
  if (a === b) return a ? [{ type: 'same', text: a }] : [];
  if (!a) return [{ type: 'add', text: b }];
  if (!b) return [{ type: 'remove', text: a }];

  const wa = tokenizeWords(a);
  const wb = tokenizeWords(b);
  if (wa.length <= MAX_WORDS && wb.length <= MAX_WORDS) {
    const edits = computeEdits(wa, wb);
    if (edits) return buildOps(edits, wa, wb);
  }
  const la = tokenizeLines(a);
  const lb = tokenizeLines(b);
  const lineEdits = computeEdits(la, lb);
  if (lineEdits) return buildOps(lineEdits, la, lb);
  return [
    { type: 'remove', text: a },
    { type: 'add', text: b },
  ];
}

function inkCount(p: NotePage): number {
  return p.ink?.length ?? 0;
}

function sameInk(a: NotePage, b: NotePage): boolean {
  const ia = (a.ink ?? []).map((s) => s.id);
  const ib = (b.ink ?? []).map((s) => s.id);
  if (ia.length !== ib.length) return false;
  const set = new Set(ib);
  return ia.every((id) => set.has(id));
}

function comparePages(bp: NotePage, ap: NotePage): PageChange {
  const textSame = bp.text === ap.text;
  const change: PageChange = {
    pageId: ap.id,
    kind: textSame && sameInk(bp, ap) ? 'same' : 'changed',
    inkBefore: inkCount(bp),
    inkAfter: inkCount(ap),
  };
  if (!textSame) change.words = diffWords(bp.text, ap.text);
  return change;
}

/**
 * Pages are matched by id. Output follows the `after` order; removed pages are listed
 * right after the page that preceded them in `before`.
 */
export function diffPages(before: NotePage[], after: NotePage[]): PageChange[] {
  const beforeById = new Map<string, NotePage>();
  for (const p of before) if (!beforeById.has(p.id)) beforeById.set(p.id, p);
  const afterIds = new Set(after.map((p) => p.id));

  const removedAfter = new Map<string, NotePage[]>();
  let anchor = '';
  for (const p of before) {
    if (afterIds.has(p.id)) {
      anchor = p.id;
      continue;
    }
    const list = removedAfter.get(anchor);
    if (list) list.push(p);
    else removedAfter.set(anchor, [p]);
  }

  const out: PageChange[] = [];
  const pushRemoved = (key: string): void => {
    for (const p of removedAfter.get(key) ?? []) {
      out.push({ pageId: p.id, kind: 'removed', inkBefore: inkCount(p), inkAfter: 0 });
    }
  };

  pushRemoved('');
  const seen = new Set<string>();
  for (const ap of after) {
    if (seen.has(ap.id)) continue;
    seen.add(ap.id);
    const bp = beforeById.get(ap.id);
    if (!bp) out.push({ pageId: ap.id, kind: 'added', inkBefore: 0, inkAfter: inkCount(ap) });
    else out.push(comparePages(bp, ap));
    pushRemoved(ap.id);
  }
  return out;
}
