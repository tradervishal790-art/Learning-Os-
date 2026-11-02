// ============================================================
// noteExportWord.ts — "Word (.docx)" export (Part 10). Loaded only when the student picks Word,
// so the docx library never weighs on the notes screen.
// Headings, bold / italic / underline / strike, lists, tasks, tables, links, highlights, text colour.
// Handwriting and photos sit ON the page where they were put in the editor: each note page is its own Word page
// and the pictures are anchored to the page (not to the text), so they keep their place whatever the text does.
// Photos are embedded when available locally. PDF pages and audio recordings remain labelled references.
// ============================================================
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  HorizontalPositionRelativeFrom,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx';
import { renderInk } from './inkSvg';
import { getImage } from './attachStore';
import { pageToHtml, type InkStroke, type NotePage, type PageAttachment } from './notebookStore';

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
  // the editor stores sizes as calc(N * var(--note-px, 1px)); N is in px
  const calc = /^calc\(\s*(\d+(?:\.\d+)?)\s*\*\s*var\(\s*--note-px\s*,\s*1px\s*\)\s*\)$/.exec(v.trim());
  const m = calc ? [calc[0], calc[1], 'px'] : /^(\d+(?:\.\d+)?)\s*(px|pt)$/.exec(v.trim());
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

/* =========================================================================
 * Page geometry. The editor sheet is 1000 "page units" wide = one A4 width (210 mm).
 * ========================================================================= */

const UNIT_EMU = 7560; // 1 page unit = 0.21 mm = 7560 EMU
const UNIT_PX = 0.7937; // … at 96 dpi (docx image sizes are in pixels)
const UNIT_TWIPS = 11.906; // … in twips
const A4_WIDTH_TWIPS = 11906;
const MAX_PAGE_TWIPS = 31680; // Word's largest page height (22 in)
const PAGE_MARGIN_TWIPS = 340; // ≈ 6 mm, close to where the editor starts the text (≈ 4 mm)

export interface WordPageLayout {
  /** Page height in page units (A4 = 1414, taller when handwriting / a photo goes lower). */
  heightUnits: number;
  heightTwips: number;
  /** < 1 only when the content is taller than Word's biggest page: everything is scaled down together. */
  scale: number;
}

/** Word page size for a note page whose lowest content reaches `extentUnits`. */
export function wordPageLayout(extentUnits: number): WordPageLayout {
  const wanted = Math.max(1414, Math.ceil(Number.isFinite(extentUnits) ? extentUnits : 0));
  const maxUnits = Math.floor(MAX_PAGE_TWIPS / UNIT_TWIPS);
  const scale = wanted > maxUnits ? maxUnits / wanted : 1;
  const heightUnits = Math.round(wanted * scale);
  return { heightUnits, heightTwips: Math.round(heightUnits * UNIT_TWIPS), scale };
}

/** A picture anchored to the PAGE at editor coordinates (page units). */
export function pageAnchor(x: number, y: number, w: number, h: number, scale = 1): {
  offsetX: number; offsetY: number; widthPx: number; heightPx: number;
} {
  return {
    offsetX: Math.max(0, Math.round(x * scale * UNIT_EMU)),
    offsetY: Math.max(0, Math.round(y * scale * UNIT_EMU)),
    widthPx: Math.max(1, Math.round(w * scale * UNIT_PX)),
    heightPx: Math.max(1, Math.round(h * scale * UNIT_PX)),
  };
}

/** Same test as the editor: a photo with a place and size lives ON the page. */
const isFloatingPhoto = (a: PageAttachment): boolean => a.kind === 'image' && a.w !== undefined && a.x !== undefined && a.y !== undefined && (a.w ?? 0) > 0;

type InkLayerName = 'hl' | 'ink';

/** One layer of the page's handwriting as a PNG covering the whole sheet width (1000 units) and `heightUnits` tall. */
async function inkLayerPng(strokes: InkStroke[], layer: InkLayerName): Promise<{ data: Uint8Array; heightUnits: number } | null> {
  const r = renderInk(strokes, false, layer);
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
  return { data, heightUnits: r.height };
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

/** A near-zero-height paragraph that carries page-anchored pictures (an anchor must live inside a paragraph). */
function anchorParagraph(children: ImageRun[]): Paragraph {
  return new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children });
}

function pageImage(
  data: Uint8Array,
  box: { x: number; y: number; w: number; h: number },
  scale: number,
  z: { behind: boolean; index: number },
  name: string
): ImageRun {
  const a = pageAnchor(box.x, box.y, box.w, box.h, scale);
  return new ImageRun({
    type: 'png',
    data,
    transformation: { width: a.widthPx, height: a.heightPx },
    altText: { name, description: name, title: name },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: a.offsetX },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: a.offsetY },
      behindDocument: z.behind,
      allowOverlap: true,
      lockAnchor: true,
      zIndex: z.index,
      wrap: { type: TextWrappingType.NONE },
    },
  });
}

/** Embed a stored photo as PNG (readers handle PNG/JPEG reliably; GIF/BMP/original MIME can fail). Null when the file is not on this device. */
async function photoPng(id: string, maxSide: number): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    const blob = await getImage(id);
    if (!blob || typeof createImageBitmap !== 'function') return null;
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const data = await canvasToPng(width, height, (ctx) => ctx.drawImage(bitmap, 0, 0, width, height));
      return { data, width, height };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/** Word export (needs docx >= 9). 'auto' ink is black on the white Word page. */
export async function exportDocx(
  title: string,
  pages: NotePage[],
  o: { includeInk: boolean; labels?: DocxLabels }
): Promise<Blob> {
  const L = { pdfPage: 'PDF page {0} ({1})', photo: 'Photo: {0}', recording: 'Recording: {0}', untitled: 'Untitled', ...(o.labels ?? {}) };
  const state: DocxState = { olInstance: 0 };
  const titlePara = new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title.trim() || L.untitled)] });
  const note = (text: string): Paragraph =>
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, italics: true, color: '6B7280' })] });

  const sections: { properties?: { page: { size: { width: number; height: number }; margin: { top: number; right: number; bottom: number; left: number; header: number; footer: number } } }; children: DocxBlock[] }[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const children: DocxBlock[] = [];
    const anchored: ImageRun[] = [];
    let extent = 0;

    // ---- pictures that live ON the page: floating photos and handwriting, at their editor position ----
    const floating = (page.attachments ?? []).filter(isFloatingPhoto);
    const placed: { a: PageAttachment; png: { data: Uint8Array; width: number; height: number }; h: number }[] = [];
    const missing: PageAttachment[] = [];
    for (const a of floating) {
      const png = await photoPng(a.id, 1400);
      if (!png) { missing.push(a); continue; }
      const h = (a.w ?? 0) * (a.ar ?? png.height / png.width);
      placed.push({ a, png, h });
      extent = Math.max(extent, (a.y ?? 0) + h);
    }
    const inkOn = o.includeInk && !!page.ink && page.ink.length > 0;
    const hl = inkOn ? await inkLayerPng(page.ink as InkStroke[], 'hl') : null;
    const pen = inkOn ? await inkLayerPng(page.ink as InkStroke[], 'ink') : null;
    if (hl) extent = Math.max(extent, hl.heightUnits);
    if (pen) extent = Math.max(extent, pen.heightUnits);
    const layout = placed.length > 0 || hl || pen ? wordPageLayout(extent) : null;
    if (layout) {
      // order = stacking: photos at the back, highlighter over them (still behind the text), pen in front of the text
      placed.forEach(({ a, png, h }, n) =>
        anchored.push(pageImage(png.data, { x: a.x ?? 0, y: a.y ?? 0, w: a.w ?? 0, h }, layout.scale, { behind: true, index: 1 + n }, a.name || a.id)));
      if (hl) anchored.push(pageImage(hl.data, { x: 0, y: 0, w: 1000, h: hl.heightUnits }, layout.scale, { behind: true, index: 100 }, 'Highlighter'));
      if (pen) anchored.push(pageImage(pen.data, { x: 0, y: 0, w: 1000, h: pen.heightUnits }, layout.scale, { behind: false, index: 200 }, 'Handwriting'));
      children.push(anchorParagraph(anchored));
    }

    if (i === 0) children.push(titlePara);
    if (page.pdf) children.push(note(fill(L.pdfPage, page.pdf.pageNumber, page.pdf.name)));
    blocksFrom(parseHtml(pageToHtml(page)).body.childNodes, { quote: false }, state, children);

    // photos that could not be embedded still get an explicit label, so nothing vanishes silently
    for (const a of missing) children.push(note(fill(L.photo, a.name || a.id)));
    // older photos (no place on the page) and recordings stay in the text flow
    for (const a of page.attachments ?? []) {
      if (isFloatingPhoto(a)) continue;
      const label = a.name || a.id;
      if (a.kind === 'image') {
        const png = await photoPng(a.id, 600);
        if (png) {
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type: 'png', data: png.data, transformation: { width: png.width, height: png.height } })],
          }));
        } else children.push(note(fill(L.photo, label)));
      } else {
        // DOCX cannot preserve a browser-local audio recording as a playable note attachment.
        children.push(note(fill(L.recording, label)));
      }
    }

    sections.push({
      ...(layout
        ? {
            properties: {
              page: {
                size: { width: A4_WIDTH_TWIPS, height: layout.heightTwips },
                margin: { top: PAGE_MARGIN_TWIPS, right: PAGE_MARGIN_TWIPS, bottom: PAGE_MARGIN_TWIPS, left: PAGE_MARGIN_TWIPS, header: 0, footer: 0 },
              },
            },
          }
        : {}),
      children,
    });
  }
  if (sections.length === 0) sections.push({ children: [titlePara] });

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
    sections,
  });
  return Packer.toBlob(doc);
}
