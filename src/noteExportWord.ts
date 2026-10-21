// ============================================================
// noteExportWord.ts — "Word (.docx)" export (Part 10). Loaded only when the student picks Word,
// so the docx library never weighs on the notes screen.
// Headings, bold / italic / underline / strike, lists, tasks, tables, links, highlights, text colour.
// Handwriting is added as one picture per page, below that page's text.
// Not in the file: the page backgrounds, the PDF pages themselves, and the photos / recordings
// (their names are listed so nothing disappears without a trace).
// ============================================================
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx';
import { renderInk } from './inkSvg';
import { pageToHtml, type InkStroke, type NotePage } from './notebookStore';

const HEX6 = /^#[0-9a-fA-F]{6}$/;
/* =========================================================================
 * DOM helpers (DOMParser only; numeric nodeType so it runs in Node + jsdom)
 * ========================================================================= */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function parseHtml(html: string): ReturnType<DOMParser['parseFromString']> {
  if (typeof DOMParser === 'undefined') throw new Error('DOMParser is not available in this environment.');
  return new DOMParser().parseFromString(html, 'text/html');
}
function isEl(n: Node): n is Element {
  return n.nodeType === ELEMENT_NODE;
}
function tagOf(el: Element): string {
  return el.tagName.toLowerCase();
}
function collapseWs(s: string): string {
  return s.replace(/[ \t\r\n\f\u00a0]+/g, ' ');
}
function safeHref(href: string | null): string | null {
  if (!href) return null;
  const h = href.trim();
  return /^(?:https?:|mailto:|tel:)/i.test(h) ? h : null;
}
function clampNum(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'hr',
  'section', 'article', 'header', 'footer', 'figure', 'details', 'summary',
]);
const SKIP_TAGS = new Set([
  'script', 'style', 'template', 'noscript', 'iframe', 'object', 'embed', 'img', 'input', 'svg', 'canvas',
  'video', 'audio', 'head', 'title', 'meta', 'link',
]);

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
function chipText(el: Element): string {
  const raw = el.getAttribute('data-seconds');
  const secs = raw === null ? Number.NaN : Number(raw);
  if (Number.isFinite(secs) && secs >= 0) return `[${formatClock(secs)}]`;
  const t = (el.textContent ?? '').trim();
  return t ? `[${t}]` : '';
}


type DocxBlock = Paragraph | Table;

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  size?: number;
  shade?: string;
  sub?: boolean;
  sup?: boolean;
}
interface ParaLead {
  opts: IParagraphOptions;
  prefix: ParagraphChild[];
}
interface BlockCtx {
  quote: boolean;
  base?: RunStyle;
  lead?: ParaLead;
  cont?: IParagraphOptions;
}
interface DocxState {
  olInstance: number;
}

const HEADINGS = new Map<string, IParagraphOptions['heading']>([
  ['h1', HeadingLevel.HEADING_1],
  ['h2', HeadingLevel.HEADING_2],
  ['h3', HeadingLevel.HEADING_3],
  ['h4', HeadingLevel.HEADING_4],
  ['h5', HeadingLevel.HEADING_5],
  ['h6', HeadingLevel.HEADING_6],
]);

function makeRun(text: string, st: RunStyle): TextRun {
  return new TextRun({
    text,
    bold: st.bold,
    italics: st.italics,
    underline: st.underline ? {} : undefined,
    strike: st.strike,
    font: st.code ? 'Courier New' : undefined,
    color: st.color,
    size: st.size,
    shading: st.shade ? { type: ShadingType.CLEAR, fill: st.shade, color: 'auto' } : undefined,
    subScript: st.sub,
    superScript: st.sup,
  });
}

function cssColorToHex(v: string): string | undefined {
  const s = v.trim();
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s);
  if (hex) {
    const h = hex[1];
    return (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toUpperCase();
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(s);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return undefined;
}

/** CSS font-size -> half-points (docx unit). */
function cssSizeToHalfPt(v: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)\s*(px|pt)$/.exec(v.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const pt = m[2] === 'px' ? n * 0.75 : n;
  return Math.round(clampNum(pt, 4, 96, 11) * 2);
}

function docxInline(node: Node, st: RunStyle): ParagraphChild[] {
  if (node.nodeType === TEXT_NODE) {
    const t = collapseWs(node.textContent ?? '');
    return t ? [makeRun(t, st)] : [];
  }
  if (!isEl(node)) return [];
  const tag = tagOf(node);
  if (SKIP_TAGS.has(tag)) return [];
  if (node.hasAttribute('data-video-ts')) {
    const t = chipText(node);
    return t ? [makeRun(t, { ...st, shade: 'E5E7EB' })] : [];
  }
  if (tag === 'br') return [new TextRun({ break: 1 })];

  let next = st;
  let link: string | null = null;
  switch (tag) {
    case 'strong':
    case 'b':
      next = { ...st, bold: true };
      break;
    case 'em':
    case 'i':
      next = { ...st, italics: true };
      break;
    case 'u':
      next = { ...st, underline: true };
      break;
    case 's':
    case 'del':
    case 'strike':
      next = { ...st, strike: true };
      break;
    case 'code':
      next = { ...st, code: true };
      break;
    case 'sub':
      next = { ...st, sub: true };
      break;
    case 'sup':
      next = { ...st, sup: true };
      break;
    case 'mark': {
      const c = node.getAttribute('data-color');
      next = { ...st, shade: c && HEX6.test(c) ? c.slice(1).toUpperCase() : 'FDE047' };
      break;
    }
    case 'a':
      link = safeHref(node.getAttribute('href'));
      if (link) next = { ...st, color: '0563C1', underline: true };
      break;
    case 'span': {
      const style = node.getAttribute('style') ?? '';
      const patch: RunStyle = {};
      for (const decl of style.split(';')) {
        const i = decl.indexOf(':');
        if (i < 0) continue;
        const prop = decl.slice(0, i).trim().toLowerCase();
        const val = decl.slice(i + 1);
        if (prop === 'color') patch.color = cssColorToHex(val);
        else if (prop === 'font-size') patch.size = cssSizeToHalfPt(val);
      }
      next = { ...st, ...patch };
      break;
    }
    default:
      break;
  }
  const kids = Array.from(node.childNodes).flatMap((c) => docxInline(c, next));
  if (link && kids.length > 0) return [new ExternalHyperlink({ link, children: kids })];
  return kids;
}

function makeParagraph(children: ParagraphChild[], ctx: BlockCtx, extra: IParagraphOptions = {}): Paragraph {
  let opts: IParagraphOptions = {};
  let kids = children;
  if (ctx.lead) {
    opts = ctx.lead.opts;
    kids = [...ctx.lead.prefix, ...children];
    ctx.lead = undefined; // only the first paragraph of a list item carries the marker
  } else if (ctx.cont) {
    opts = ctx.cont;
  }
  return new Paragraph({
    children: kids,
    spacing: { after: 100 },
    border: ctx.quote ? { left: { style: BorderStyle.SINGLE, size: 12, color: '9CA3AF', space: 8 } } : undefined,
    ...opts,
    ...extra,
  });
}

function blocksFrom(nodes: ArrayLike<Node>, ctx: BlockCtx, state: DocxState, out: DocxBlock[]): void {
  let pending: Node[] = [];
  const flush = (): void => {
    if (pending.length === 0) return;
    const run = pending;
    pending = [];
    if (run.every((n) => n.nodeType === TEXT_NODE && (n.textContent ?? '').trim() === '')) return;
    const kids = run.flatMap((n) => docxInline(n, ctx.base ?? {}));
    if (kids.length > 0) out.push(makeParagraph(kids, ctx));
  };
  for (const n of Array.from(nodes)) {
    if (isEl(n) && BLOCK_TAGS.has(tagOf(n))) {
      flush();
      docxBlock(n, ctx, state, out);
    } else {
      pending.push(n);
    }
  }
  flush();
}

function docxList(list: Element, level: number, ctx: BlockCtx, state: DocxState, out: DocxBlock[]): void {
  const ordered = tagOf(list) === 'ol';
  const taskList = list.getAttribute('data-type') === 'taskList';
  const instance = ordered ? ++state.olInstance : 0;
  const lvl = Math.min(level, 4);
  for (const li of Array.from(list.children)) {
    if (tagOf(li) !== 'li') continue;
    const isTask = taskList || li.hasAttribute('data-checked');
    const checked = li.getAttribute('data-checked') === 'true';
    const itemCtx: BlockCtx = {
      quote: ctx.quote,
      base: ctx.base,
      cont: { indent: { left: 360 * (lvl + 2) } },
      lead: isTask
        ? { opts: { indent: { left: 360 * (lvl + 1) } }, prefix: [makeRun(checked ? '\u2611 ' : '\u2610 ', {})] }
        : ordered
          ? { opts: { numbering: { reference: 'ol', level: lvl, instance } }, prefix: [] }
          : { opts: { bullet: { level: lvl } }, prefix: [] },
    };
    let run: Node[] = [];
    const flushRun = (): void => {
      if (run.length === 0) return;
      const nodes = run;
      run = [];
      blocksFrom(nodes, itemCtx, state, out);
    };
    for (const c of Array.from(li.childNodes)) {
      if (isEl(c)) {
        const t = tagOf(c);
        if (t === 'label') continue;
        if (t === 'ul' || t === 'ol') {
          flushRun();
          if (itemCtx.lead) out.push(makeParagraph([], itemCtx));
          docxList(c, level + 1, ctx, state, out);
          continue;
        }
      }
      run.push(c);
    }
    flushRun();
    if (itemCtx.lead) out.push(makeParagraph([], itemCtx));
  }
}

function docxTable(table: Element, state: DocxState, out: DocxBlock[]): void {
  const trs = Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
  const rowsOfCells = trs
    .map((tr) => Array.from(tr.children).filter((c) => tagOf(c) === 'td' || tagOf(c) === 'th'))
    .filter((r) => r.length > 0);
  if (rowsOfCells.length === 0) return;
  const cols = Math.max(...rowsOfCells.map((r) => r.length));
  const colW = Math.floor(9000 / cols);
  const border = { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' };
  const rows = rowsOfCells.map((cells) => {
    const built = cells.map((c) => {
      const isHead = tagOf(c) === 'th';
      const inner: DocxBlock[] = [];
      blocksFrom(c.childNodes, { quote: false, base: isHead ? { bold: true } : undefined }, state, inner);
      if (inner.length === 0) inner.push(new Paragraph({}));
      return new TableCell({
        children: inner,
        width: { size: colW, type: WidthType.DXA },
        shading: isHead ? { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' } : undefined,
      });
    });
    while (built.length < cols) {
      built.push(new TableCell({ children: [new Paragraph({})], width: { size: colW, type: WidthType.DXA } }));
    }
    return new TableRow({ children: built });
  });
  out.push(
    new Table({
      rows,
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: Array.from({ length: cols }, () => colW),
      borders: {
        top: border,
        bottom: border,
        left: border,
        right: border,
        insideHorizontal: border,
        insideVertical: border,
      },
    }),
  );
  out.push(new Paragraph({}));
}

function docxBlock(el: Element, ctx: BlockCtx, state: DocxState, out: DocxBlock[]): void {
  const tag = tagOf(el);
  const heading = HEADINGS.get(tag);
  if (heading) {
    out.push(makeParagraph(Array.from(el.childNodes).flatMap((n) => docxInline(n, ctx.base ?? {})), ctx, { heading }));
    return;
  }
  switch (tag) {
    case 'p':
      out.push(makeParagraph(Array.from(el.childNodes).flatMap((n) => docxInline(n, ctx.base ?? {})), ctx));
      return;
    case 'ul':
    case 'ol':
      docxList(el, 0, ctx, state, out);
      return;
    case 'blockquote':
      blocksFrom(el.childNodes, { ...ctx, quote: true }, state, out);
      return;
    case 'pre': {
      const raw = (el.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
      const runs = raw.split('\n').map((l, i) => new TextRun({ text: l, font: 'Courier New', size: 20, break: i > 0 ? 1 : undefined }));
      out.push(makeParagraph(runs, ctx, { shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' } }));
      return;
    }
    case 'table':
      docxTable(el, state, out);
      return;
    case 'hr':
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '9CA3AF', space: 1 } } }));
      return;
    default:
      blocksFrom(el.childNodes, ctx, state, out);
  }
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

async function canvasToPng(w: number, h: number, draw: (ctx: Ctx2D) => void): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Could not create a drawing surface for the handwriting.');
    draw(ctx);
    const blob = await c.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Could not create a drawing surface for the handwriting.');
  draw(ctx);
  const blob = await new Promise<Blob>((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}

async function inkPng(strokes: InkStroke[]): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  const r = renderInk(strokes, false, 'both');
  if (r.shapes.length === 0) return null;
  const scale = Math.min(1.2, 8000 / r.height);
  const w = Math.max(1, Math.round(1000 * scale));
  const h = Math.max(1, Math.round(r.height * scale));
  const data = await canvasToPng(w, h, (ctx) => {
    ctx.scale(scale, scale);
    for (const s of r.shapes) {
      const path = new Path2D(s.d);
      ctx.globalAlpha = s.opacity;
      if (s.dots) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.dots.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([0, s.dots.gap]);
        ctx.stroke(path);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = s.color;
        ctx.fill(path);
      }
    }
    ctx.globalAlpha = 1;
  });
  let dispW = 600; // px at 96 dpi, fits A4 with 1" margins
  let dispH = (dispW * r.height) / 1000;
  if (dispH > 900) {
    dispH = 900;
    dispW = (900 * 1000) / r.height;
  }
  return { data, width: Math.round(dispW), height: Math.round(dispH) };
}

export interface DocxLabels {
  /** "PDF page {0}: {1}" style lines are built by the caller-supplied labels; English fallbacks keep the file readable. */
  pdfPage?: string;
  photo?: string;
  recording?: string;
  untitled?: string;
}

function fill(template: string, ...args: (string | number)[]): string {
  return args.reduce<string>((acc, a, i) => acc.split(`{${i}}`).join(String(a)), template);
}

/** Word export (needs docx >= 9). 'auto' ink is black on the white Word page. */
export async function exportDocx(
  title: string,
  pages: NotePage[],
  o: { includeInk: boolean; labels?: DocxLabels }
): Promise<Blob> {
  const L = { pdfPage: 'PDF page {0} ({1})', photo: 'Photo: {0}', recording: 'Recording: {0}', untitled: 'Untitled', ...(o.labels ?? {}) };
  const state: DocxState = { olInstance: 0 };
  const children: DocxBlock[] = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title.trim() || L.untitled)] })];
  const note = (text: string): Paragraph =>
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, italics: true, color: '6B7280' })] });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (page.pdf) children.push(note(fill(L.pdfPage, page.pdf.pageNumber, page.pdf.name)));
    blocksFrom(parseHtml(pageToHtml(page)).body.childNodes, { quote: false }, state, children);
    for (const a of page.attachments ?? []) children.push(note(fill(a.kind === 'image' ? L.photo : L.recording, a.name || a.id)));
    if (o.includeInk && page.ink && page.ink.length > 0) {
      const img = await inkPng(page.ink);
      if (img) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: img.width, height: img.height } })],
          })
        );
      }
    }
  }
  const doc = new DocxDocument({
    creator: 'Learning OS',
    title: title.trim() || L.untitled,
    numbering: {
      config: [
        {
          reference: 'ol',
          levels: [0, 1, 2, 3, 4].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}
