import { PAGE_RATIO } from './inkEngine';
import { paperColor, paperIsDark, templateSpacing, type PageTemplateId } from './pageTemplates';

// ============================================================
// pagePaperPrint.ts — the paper under a page (ruled / grid / dotted / …) for PRINT and PDF export.
// PageBackground.tsx draws the same paper on screen as an SVG; a printed page has no React, so this
// builds the same SVG as a string. It is an overlay in PAGE UNITS (1000 wide) that scales with the sheet
// like the editor does — a vector pattern, so lines stay exact at any print size (CSS tile backgrounds
// round their size to whole pixels and drift). Pure, so it is easy to test.
// ============================================================

export interface PaperPrint {
  /** Declarations for the page's inline style (paper colour). Safe inside style="…". */
  style: string;
  /** The paper's lines / grid / dots as one SVG, or '' (blank paper). Goes first inside the page. */
  overlay: string;
  /** Paper is dark → text and automatic ink must be light. */
  dark: boolean;
  /** The paper colour (CSS), or '' for the default white. */
  fill: string;
  /** The raw SVG parts (patterns / lines), for building a standalone picture of the paper at any height (Word export). */
  defs: string;
  body: string;
}

const SW = 1.5; // line thickness, page units (a touch above the on-screen hairline so thin lines survive printing)
const FAR = 20000; // the pattern rect is far taller than any sheet; the SVG viewport clips it

const r = (n: number): number => Math.round(n * 1000) / 1000;

export function paperPrint(template: PageTemplateId, paper: string | undefined): PaperPrint {
  const dark = paperIsDark(paper, false);
  const fill = paperColor(paper, false);
  const line = dark ? '#4a5059' : '#c4cbd6';
  const frame = dark ? '#6b727d' : '#a9b3c2';
  const margin = dark ? '#7a4a52' : '#e49a9a';
  const sp = templateSpacing(template);
  let defs = '';
  let body = '';

  const rule = (y: number) => `<line x1="0" y1="${r(y)}" x2="10" y2="${r(y)}" stroke="${line}" stroke-width="${SW}"/>`;
  const pattern = (id: string, w: number, h: number, inner: string) =>
    `<pattern id="${id}" width="${r(w)}" height="${r(h)}" patternUnits="userSpaceOnUse">${inner}</pattern>`;
  const fillRect = (id: string, x = 0, y = 0, w = 1000, h = FAR) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})"/>`;

  if (sp > 0) {
    switch (template) {
      case 'ruled': case 'ruledNarrow': case 'ruledWide':
        defs = pattern('pp', 10, sp, rule(sp - SW / 2));
        body = fillRect('pp');
        break;
      case 'notebook':
        defs = pattern('pp', 10, sp, rule(sp - SW / 2));
        body = fillRect('pp') + `<line x1="120" y1="0" x2="120" y2="${FAR}" stroke="${margin}" stroke-width="${SW * 1.5}"/>`;
        break;
      case 'dotted':
        defs = pattern('pp', sp, sp, `<circle cx="${sp / 2}" cy="${sp / 2}" r="1.8" fill="${line}"/>`);
        body = fillRect('pp');
        break;
      case 'grid': case 'graph':
        defs = pattern('pp', sp, sp, `<path d="M0 ${r(sp - SW / 2)} H${sp} M${r(sp - SW / 2)} 0 V${sp}" stroke="${line}" stroke-width="${SW}" fill="none"/>`);
        body = fillRect('pp');
        break;
      case 'isometric': {
        const h = sp * Math.sqrt(3);
        const dots = [[sp / 2, h / 4], [0, (h * 3) / 4], [sp, (h * 3) / 4]].map(([x, y]) => `<circle cx="${r(x)}" cy="${r(y)}" r="1.8" fill="${line}"/>`).join('');
        defs = pattern('pp', sp, h, dots);
        body = fillRect('pp');
        break;
      }
      case 'music': {
        // one 5-line staff per 7 spacings, so there is a gap between staves
        defs = pattern('pp', 10, sp * 7, [0, 1, 2, 3, 4].map((n) => rule(sp * (1.5 + n))).join(''));
        body = fillRect('pp');
        break;
      }
      case 'todo': {
        const box = sp * 0.5;
        defs = pattern('pp', 10, sp, rule(sp - SW / 2))
          + pattern('pb', box, sp, `<rect x="${SW / 2}" y="${r(sp * 0.3)}" width="${r(box - SW)}" height="${r(box - SW)}" rx="${SW * 1.5}" fill="none" stroke="${line}" stroke-width="${SW}"/>`);
        body = fillRect('pp') + `<g transform="translate(${r(sp * 0.5)} 0)">${fillRect('pb', 0, 0, r(box), FAR)}</g>`;
        break;
      }
      case 'cornell': {
        // Cornell geometry is fixed against an A4 page (the same numbers as PageBackground).
        const pageH = 1000 * PAGE_RATIO;
        const headerY = sp * 1.5;
        const cueX = 250;
        const summaryY = pageH * 0.82;
        defs = pattern('pp', 10, sp, rule(sp - SW / 2));
        body = `<g transform="translate(${cueX} ${r(headerY)})">${fillRect('pp', 0, 0, 1000 - cueX, r(Math.max(0, summaryY - headerY)))}</g>`
          + `<line x1="0" y1="${r(headerY)}" x2="1000" y2="${r(headerY)}" stroke="${frame}" stroke-width="${SW * 1.5}"/>`
          + `<line x1="${cueX}" y1="${r(headerY)}" x2="${cueX}" y2="${r(summaryY)}" stroke="${frame}" stroke-width="${SW * 1.5}"/>`
          + `<line x1="0" y1="${r(summaryY)}" x2="1000" y2="${r(summaryY)}" stroke="${frame}" stroke-width="${SW * 1.5}"/>`;
        break;
      }
      default:
        break;
    }
  }

  const overlay = body
    ? `<svg class="paper-extra" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${r(1000 * PAGE_RATIO)}" preserveAspectRatio="xMinYMin meet" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`
    : '';
  return { style: fill ? `background-color:${fill}` : '', overlay, dark, fill: fill ?? '', defs, body };
}

/** The paper as a standalone SVG, 1000 units wide and `heightUnits` tall (patterns run the full height). */
export function paperSvg(p: PaperPrint, heightUnits: number, o: { background?: boolean } = {}): string {
  const h = Math.max(1, Math.round(heightUnits));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${h}" width="1000" height="${h}">`
    + (o.background !== false && p.fill ? `<rect width="1000" height="${h}" fill="${p.fill}"/>` : '')
    + `<defs>${p.defs}</defs>${p.body}</svg>`;
}
