// ============================================================
// pageLayout.ts — lays a page's typed text out as lines in PAGE UNITS (page width = 1000, like ink), so the
// direct PDF export (exportNotePdf.ts) can draw it on a canvas next to the handwriting. Pure: the caller
// passes `measure`, so the same code is unit-tested with a fake font and runs with a real canvas in the app.
// The canvas does the text shaping, which is why Devanagari / Arabic / Tamil come out right in the PDF.
// ============================================================

export interface TextLine {
  text: string;
  x: number;
  /** Baseline-top of the line. */
  y: number;
  size: number;
  bold: boolean;
}
export type Measure = (text: string, size: number, bold: boolean) => number;

/** Editor text at the reference width: 16px at 768px wide = 20.8 units at 1000. */
export const BASE_SIZE = 20.8;
const LINE_H = 1.5;
const MARGIN = 20.8; // the editor pads 1em
const HEAD: Record<string, number> = { H1: 2, H2: 1.5, H3: 1.17, H4: 1, H5: 0.9, H6: 0.85 };
const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'DIV']);

function textOf(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  clone.querySelectorAll('ul,ol').forEach((n) => n.remove()); // nested lists are their own items
  return (clone.textContent ?? '').replace(/[ \t\u00a0]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

function wrap(text: string, maxW: number, size: number, bold: boolean, measure: Measure): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ').filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (!line || measure(next, size, bold) <= maxW) {
        line = next;
        // a single word wider than the line (or text without spaces): break by characters
        while (measure(line, size, bold) > maxW && [...line].length > 1) {
          const chars = [...line];
          let cut = chars.length - 1;
          while (cut > 1 && measure(chars.slice(0, cut).join(''), size, bold) > maxW) cut--;
          out.push(chars.slice(0, cut).join(''));
          line = chars.slice(cut).join('');
        }
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line); // an empty paragraph line stays as a blank line
  }
  return out;
}

export function layoutText(html: string, measure: Measure, opts: { width?: number } = {}): { lines: TextLine[]; height: number } {
  const width = opts.width ?? 1000;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const lines: TextLine[] = [];
  let y = MARGIN;

  const emit = (text: string, o: { size?: number; bold?: boolean; indent?: number; prefix?: string; gapBefore?: number }) => {
    if (!text) return;
    const size = o.size ?? BASE_SIZE;
    const bold = o.bold ?? false;
    const indent = o.indent ?? 0;
    y += o.gapBefore ?? 0;
    const prefix = o.prefix ?? '';
    const bodyX = MARGIN + indent + (prefix ? size * 1.4 : 0);
    const rows = wrap(text, width - MARGIN - bodyX, size, bold, measure);
    rows.forEach((row, i) => {
      if (i === 0 && prefix) lines.push({ text: prefix, x: MARGIN + indent, y, size, bold });
      if (row) lines.push({ text: row, x: bodyX, y, size, bold });
      y += size * LINE_H;
    });
  };

  const walk = (parent: Element, indent: number) => {
    for (const el of Array.from(parent.children)) {
      const tag = el.tagName;
      if (tag === 'UL' || tag === 'OL') {
        let n = 0;
        for (const li of Array.from(el.children)) {
          if (li.tagName !== 'LI') continue;
          n++;
          const checked = li.getAttribute('data-checked');
          const prefix = checked !== null ? (checked === 'true' ? '☑' : '☐') : tag === 'OL' ? `${n}.` : '•';
          emit(textOf(li), { prefix, indent });
          walk(li, indent + 28);
        }
        y += BASE_SIZE * 0.3;
      } else if (tag === 'BLOCKQUOTE') {
        emit(textOf(el), { indent: indent + 28, gapBefore: BASE_SIZE * 0.2 });
        y += BASE_SIZE * 0.4;
      } else if (tag === 'TABLE') {
        el.querySelectorAll('tr').forEach((tr) => emit(Array.from(tr.children).map((c) => textOf(c)).join('  |  '), { indent }));
        y += BASE_SIZE * 0.4;
      } else if (tag === 'HR') {
        y += BASE_SIZE;
      } else if (HEAD[tag]) {
        emit(textOf(el), { size: BASE_SIZE * HEAD[tag], bold: true, indent, gapBefore: BASE_SIZE * 0.5 });
        y += BASE_SIZE * 0.2;
      } else if (BLOCKS.has(tag)) {
        const text = textOf(el);
        if (text || tag === 'P') {
          if (text) emit(text, { indent });
          else y += BASE_SIZE * LINE_H; // an empty paragraph is a blank line
          y += BASE_SIZE * 0.35;
        }
        if (tag === 'DIV') walk(el, indent);
      }
    }
  };
  walk(doc.body, 0);
  return { lines, height: y + MARGIN };
}
