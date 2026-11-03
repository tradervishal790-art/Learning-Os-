import type { InkStroke } from './notebookStore';
import { isTemplateId, textLineUnits } from './pageTemplates';
import { PAGE_UNITS, TEXT_REF_WIDTH } from './inkEngine';
import { strokePoints } from './inkEdit';

// ============================================================
// penHighlightText.ts — which typed words lie under a highlighter-pen mark?
// A pen mark is only a stroke. The page text is laid out exactly as the editor lays it out (same classes, same
// width rule: text size follows the page width), every word's box is measured, and a word counts as marked when
// a stroke covers most of it. coveredText() is pure (testable without a browser); measureWords() needs the DOM.
// ============================================================

export interface WordBox { text: string; x0: number; y0: number; x1: number; y1: number; block: number }

const HL_THICKNESS = 6; // highlighter drawn width = stroke.width × 6 (see KINDS.highlighter.size)
const COVER = 0.5; // share of a word's sample points a mark must cover

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Does any of these marks cover at least half of the word's box? (sampled on a small grid) */
function covered(word: WordBox, marks: InkStroke[]): boolean {
  const cols = 6, rows = 3;
  let hit = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = word.x0 + ((i + 0.5) / cols) * (word.x1 - word.x0);
      const y = word.y0 + ((j + 0.5) / rows) * (word.y1 - word.y0);
      if (marks.some((m) => {
        const half = (m.width * HL_THICKNESS) / 2;
        const pts = strokePoints(m);
        if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= half;
        for (let k = 1; k < pts.length; k++) if (distToSegment(x, y, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]) <= half) return true;
        return false;
      })) hit++;
    }
  }
  return hit / (cols * rows) >= COVER;
}

/** The typed words under the given marks, in reading order; words of one paragraph/line group are joined, paragraphs by a new line. */
export function coveredText(words: readonly WordBox[], marks: InkStroke[]): string {
  const parts: string[] = [];
  let lastBlock = -1;
  for (const w of words) {
    if (!covered(w, marks)) continue;
    if (w.block !== lastBlock && parts.length > 0) parts.push('\n');
    else if (parts.length > 0) parts.push(' ');
    parts.push(w.text);
    lastBlock = w.block;
  }
  return parts.join('').replace(/ ?\n ?/g, '\n').trim();
}

const BLOCKS = 'p,li,td,th,h1,h2,h3,h4,blockquote';
const DROP = 'script,style,iframe,object,embed,svg,img,video,audio,canvas,link,meta,form';

/** Lay the page's HTML out like the editor does and measure every word, in page units. Browser only. */
export async function measureWords(html: string, template: string | undefined): Promise<WordBox[]> {
  const W = TEXT_REF_WIDTH; // text size follows the page width; at the reference width 1 text px = 1 px
  const scale = W / PAGE_UNITS;
  const linePx = (isTemplateId(template) ? textLineUnits(template) : 0) * scale;
  const doc = new DOMParser().parseFromString(html, 'text/html'); // inert: nothing runs while it is parsed
  doc.body.querySelectorAll(DROP).forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
  });

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:absolute;left:-10000px;top:0;width:${W}px;visibility:hidden;pointer-events:none`;
  const sheet = document.createElement('div');
  sheet.className = linePx > 0 ? 'note-gridded' : '';
  sheet.style.cssText = `box-sizing:border-box;border:1px solid transparent;padding:1em;font-size:16px;--note-px:1px;position:relative;${linePx > 0 ? `--note-line:${linePx}px;padding-top:max(0px, calc(var(--note-line) / 2 - 0.47em));` : ''}`;
  const prose = document.createElement('div');
  prose.className = 'tiptap ProseMirror note-prose';
  while (doc.body.firstChild) prose.appendChild(document.adoptNode(doc.body.firstChild));
  sheet.appendChild(prose);
  host.appendChild(sheet);
  document.body.appendChild(host);
  try {
    try { await document.fonts?.ready; } catch { /* measure with what is loaded */ }
    const origin = sheet.getBoundingClientRect();
    const blocks = new Map<Element, number>();
    const out: WordBox[] = [];
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      const block = (n.parentElement?.closest(BLOCKS)) ?? prose;
      if (!blocks.has(block)) blocks.set(block, blocks.size);
      for (const m of text.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(n, m.index ?? 0);
        range.setEnd(n, (m.index ?? 0) + m[0].length);
        const r = range.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        out.push({ text: m[0], x0: (r.left - origin.left) / scale, y0: (r.top - origin.top) / scale, x1: (r.right - origin.left) / scale, y1: (r.bottom - origin.top) / scale, block: blocks.get(block) as number });
      }
    }
    return out;
  } finally {
    host.remove();
  }
}
