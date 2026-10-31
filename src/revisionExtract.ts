// ============================================================
// revisionExtract.ts — collect every highlighted passage of a note
// (the typed text) so the student can study "only my doubts".
//
// Highlight colours carry meaning:
//   yellow = important, green = understood, pink = doubt, blue = example.
// Pure: runs in the browser and in jsdom (uses DOMParser, never regexes on HTML).
// ============================================================

export type HighlightKind = 'important' | 'understood' | 'doubt' | 'example' | 'other';

export interface HighlightItem {
  /** Stable id: kind + normalised text. */
  key: string;
  kind: HighlightKind;
  /** Hex colour of the first occurrence. */
  color: string;
  text: string;
  pages: { pageId: string; pageNumber: number }[];
  /** How often it was highlighted in total (repeated highlights = important to the student). */
  count: number;
  /** A highlighter-PEN mark: it has no text, the sheet shows a picture of the region (see inkHighlights.ts). */
  ink?: boolean;
  /** Data URL of that picture once it has been drawn. */
  image?: string;
}

/** The four official highlight colours (same values the highlighter palette uses). */
export const OFFICIAL_COLORS: Record<Exclude<HighlightKind, 'other'>, string> = {
  important: '#fde047',
  understood: '#86efac',
  doubt: '#f9a8d4',
  example: '#93c5fd',
};

const KIND_ORDER: HighlightKind[] = ['important', 'doubt', 'example', 'understood', 'other'];
const BLOCK_SELECTOR = 'p, li, td, th, h1, h2, h3, h4, blockquote';
const MATCH_DISTANCE = 60;

type RGB = [number, number, number];

/** '#fde047', '#fd4', 'rgb(253, 224, 71)', 'rgba(253,224,71,0.5)' -> [r, g, b]. null when it is not a colour. */
export function parseColor(input: string | null | undefined): RGB | null {
  if (!input) return null;
  const c = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(c);
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16)) as RGB;
  m = /^#([0-9a-f]{6})$/.exec(c);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(c);
  if (m) return [Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])];
  return null;
}

const toHex = ([r, g, b]: RGB): string => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const OFFICIAL_RGB = (Object.entries(OFFICIAL_COLORS) as [Exclude<HighlightKind, 'other'>, string][]).map(
  ([kind, hex]) => ({ kind, rgb: parseColor(hex) as RGB })
);

/** Which meaning a colour has: exact match first, else the nearest official colour if it is close enough. */
export function colorKind(color: string): HighlightKind {
  const rgb = parseColor(color);
  if (!rgb) return 'other';
  let best: { kind: HighlightKind; d: number } = { kind: 'other', d: Infinity };
  for (const o of OFFICIAL_RGB) {
    const d = Math.hypot(rgb[0] - o.rgb[0], rgb[1] - o.rgb[1], rgb[2] - o.rgb[2]);
    if (d < best.d) best = { kind: o.kind, d };
  }
  return best.d < MATCH_DISTANCE ? best.kind : 'other';
}

/** The colour of a <mark>: data-color first, else its inline background-color. */
function markColor(mark: Element): RGB | null {
  return parseColor(mark.getAttribute('data-color')) ?? parseColor((mark as HTMLElement).style?.backgroundColor);
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

interface Run { hex: string | null; text: string }

/** Passages of ONE block element: adjacent marks of the same colour (only whitespace between) are one passage. */
function passagesInBlock(block: Element, doc: Document): { hex: string; text: string }[] {
  const runs: Run[] = [];
  const walker = doc.createTreeWalker(block, 4 /* SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    const mark = parent?.closest('mark');
    const rgb = mark && block.contains(mark) ? markColor(mark) : null;
    const hex = rgb ? toHex(rgb) : null;
    const text = n.textContent ?? '';
    const last = runs[runs.length - 1];
    if (last && last.hex === hex) last.text += text;
    else runs.push({ hex, text });
  }

  const out: { hex: string; text: string }[] = [];
  let current: { hex: string; text: string } | null = null;
  for (const r of runs) {
    if (r.hex) {
      if (current && current.hex === r.hex) current.text += r.text;
      else {
        if (current) out.push(current);
        current = { hex: r.hex, text: r.text };
      }
    } else if (current && collapse(r.text) === '') {
      current.text += r.text; // only whitespace between two marks: the passage continues
    } else if (current) {
      out.push(current);
      current = null;
    }
  }
  if (current) out.push(current);
  return out.map((p) => ({ hex: p.hex, text: collapse(p.text) })).filter((p) => p.text !== '');
}

export function extractHighlights(pages: { id: string; html: string }[]): HighlightItem[] {
  const parser = new DOMParser();
  const byKey = new Map<string, HighlightItem & { first: number }>();
  let seq = 0;

  pages.forEach((page, pageIndex) => {
    const doc = parser.parseFromString(`<body>${page.html}</body>`, 'text/html');
    // one group per nearest block; marks outside any block share the body
    const blocks = new Set<Element>();
    doc.querySelectorAll('mark').forEach((m) => blocks.add(m.closest(BLOCK_SELECTOR) ?? doc.body));
    // keep document order
    const ordered = Array.from(doc.querySelectorAll(`${BLOCK_SELECTOR}, body`)).filter((b) => blocks.has(b));
    for (const block of ordered) {
      for (const p of passagesInBlock(block, doc)) {
        const kind = colorKind(p.hex);
        const key = `${kind}${kind === 'other' ? p.hex : ''}|${p.text.toLowerCase()}`;
        const existing = byKey.get(key);
        const pageRef = { pageId: page.id, pageNumber: pageIndex + 1 };
        if (existing) {
          existing.count += 1;
          if (!existing.pages.some((x) => x.pageId === page.id)) existing.pages.push(pageRef);
        } else {
          byKey.set(key, { key, kind, color: p.hex, text: p.text, pages: [pageRef], count: 1, first: seq++ });
        }
      }
    }
  });

  return Array.from(byKey.values())
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.count - a.count || a.first - b.first)
    .map(({ first, ...item }) => {
      void first;
      return item;
    });
}

/** Plain text for "Copy all": a heading per kind, then "- passage (Page 2, 5) ×3" lines. */
export function itemsToText(items: HighlightItem[], labels: { kinds: Record<HighlightKind, string>; page: string; ink?: string }): string {
  const lines: string[] = [];
  for (const kind of KIND_ORDER) {
    const group = items.filter((i) => i.kind === kind);
    if (group.length === 0) continue;
    if (lines.length > 0) lines.push('');
    lines.push(labels.kinds[kind]);
    for (const i of group) {
      const pg = i.pages.map((p) => p.pageNumber).join(', ');
      lines.push(`- ${i.ink ? `[${labels.ink ?? 'Handwritten highlight'}]` : i.text} (${labels.page} ${pg})${i.count > 1 ? ` ×${i.count}` : ''}`);
    }
  }
  return lines.join('\n');
}
