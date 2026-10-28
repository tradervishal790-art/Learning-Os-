import type { NotePage, NoteVideo } from './notebookStore';
import { inkToSvg } from './inkSvg';

// ============================================================
// noteExport.ts — turn a note into a file (Part 10).
// Text formats carry the typed text; the backup file carries everything
// (handwriting, page settings, linked video).
// ============================================================

// Same rule as pageToHtml in notebookStore (kept here so this file has no runtime dependency on the store).
const pageToHtml = (p: NotePage): string =>
  p.html ?? p.text.split('\n').map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');

const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR']);

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (el.hasAttribute('data-video-ts')) return `[${(el.textContent ?? '').replace(/[▶\s]+/g, ' ').trim()}]`;
  const inner = Array.from(el.childNodes).map(inline).join('');
  switch (el.tagName) {
    case 'STRONG':
    case 'B':
      return inner.trim() ? `**${inner.trim()}**` : '';
    case 'EM':
    case 'I':
      return inner.trim() ? `*${inner.trim()}*` : '';
    case 'S':
    case 'DEL':
      return inner.trim() ? `~~${inner.trim()}~~` : '';
    case 'U':
    case 'INS':
      return inner.trim() ? `<u>${inner.trim()}</u>` : '';
    case 'SUB':
      return inner.trim() ? `<sub>${inner.trim()}</sub>` : '';
    case 'SUP':
      return inner.trim() ? `<sup>${inner.trim()}</sup>` : '';
    case 'MARK':
      return inner.trim() ? `==${inner.trim()}==` : '';
    case 'SPAN': {
      // Browsers canonicalize inline hex colours to rgb(...), so accept both safe CSS forms.
      const color = el.style.color.trim();
      const safeColor = /^(?:#[0-9a-f]{3}(?:[0-9a-f]{3})?|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\))$/i.test(color)
        ? color
        : '';
      return inner.trim() && safeColor ? `<span style="color: ${safeColor}">${inner.trim()}</span>` : inner;
    }
    case 'CODE': {
      const code = el.textContent ?? '';
      if (!code) return '';
      const longestTicks = Math.max(0, ...Array.from(code.matchAll(/`+/g), (m) => m[0].length));
      const fence = '`'.repeat(Math.max(1, longestTicks + 1));
      return `${fence}${code}${fence}`;
    }
    case 'A': {
      const href = el.getAttribute('href')?.trim() ?? '';
      // Do not emit active javascript:/data: links into exported Markdown.
      const safeHref = /^(?:https?:|mailto:|tel:|\/|#|\.\.?\/)/i.test(href) ? href : '';
      const label = inner.trim();
      const markdownHref = safeHref.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '%5C');
      const markdownLabel = label.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
      return safeHref && label ? `[${markdownLabel}](${markdownHref})` : inner;
    }
    case 'BR':
      return '  \n';
    default:
      return inner;
  }
}

function list(el: Element, depth: number): string {
  const ordered = el.tagName === 'OL';
  let n = 1;
  const lines: string[] = [];
  for (const li of Array.from(el.children)) {
    if (li.tagName !== 'LI') continue;
    const task = li.hasAttribute('data-checked') || el.getAttribute('data-type') === 'taskList';
    const checked = li.getAttribute('data-checked') === 'true';
    const mark = task ? (checked ? '- [x] ' : '- [ ] ') : ordered ? `${n++}. ` : '- ';
    const own: string[] = [];
    const nested: string[] = [];
    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && ['UL', 'OL'].includes((child as Element).tagName)) nested.push(list(child as Element, depth + 1));
      else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName === 'LABEL') continue; // task checkbox label
      else own.push(inline(child));
    }
    lines.push(`${'  '.repeat(depth)}${mark}${own.join('').replace(/\s+/g, ' ').trim()}`);
    nested.forEach((x) => lines.push(x));
  }
  return lines.join('\n');
}

function table(el: Element): string {
  const rows = Array.from(el.querySelectorAll('tr')).filter((tr) => tr.closest('table') === el).map((tr) =>
    Array.from(tr.children).map((c) => inline(c).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim())
  );
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
  return [pad(rows[0]), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...rows.slice(1).map(pad)].join('\n');
}

function blocks(parent: Element): string[] {
  const out: string[] = [];
  let run = '';
  const flush = () => {
    if (run.trim()) out.push(run.trim());
    run = '';
  };
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE || !BLOCK.has((node as Element).tagName)) {
      run += inline(node);
      continue;
    }
    flush();
    const el = node as Element;
    const tag = el.tagName;
    if (/^H[1-6]$/.test(tag)) out.push(`${'#'.repeat(Number(tag[1]))} ${inline(el).trim()}`);
    else if (tag === 'UL' || tag === 'OL') out.push(list(el, 0));
    else if (tag === 'BLOCKQUOTE') out.push(blocks(el).join('\n\n').split('\n').map((l) => `> ${l}`).join('\n'));
    else if (tag === 'PRE') {
      const code = (el.textContent ?? '').replace(/\n$/, '');
      const longestTicks = Math.max(0, ...Array.from(code.matchAll(/`+/g), (m) => m[0].length));
      const fence = '`'.repeat(Math.max(3, longestTicks + 1));
      out.push(`${fence}\n${code}\n${fence}`);
    }
    else if (tag === 'TABLE') out.push(table(el));
    else if (tag === 'HR') out.push('---');
    else if (tag === 'DIV') out.push(...blocks(el));
    else out.push(inline(el).trim());
  }
  flush();
  return out.filter((b) => b.trim() !== '');
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return blocks(doc.body).join('\n\n');
}

const pageTitle = (p: NotePage, i: number, pages: NotePage[]) =>
  p.pdf ? `${p.pdf.name} · ${p.pdf.pageNumber}` : pages.length > 1 ? `Page ${i + 1}` : '';

export function noteToMarkdown(title: string, pages: NotePage[]): string {
  const safeTitle = (title.trim() || 'Untitled').replace(/([\\\\`*_{}\\[\\]()#+.!|>~-])/g, '\\\\$1');
  const parts = [`# ${safeTitle}`];
  pages.forEach((p, i) => {
    const heading = pageTitle(p, i, pages);
    const body = p.pdf ? p.text.trim() : htmlToMarkdown(pageToHtml(p));
    if (!body && !heading) return;
    if (heading) parts.push(`## ${heading}`);
    if (body) parts.push(body);
  });
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export function noteToText(title: string, pages: NotePage[]): string {
  const body = pages.map((p, i) => {
    const heading = pageTitle(p, i, pages);
    const text = p.text.trim();
    // Keep PDF/page boundaries in plain-text exports, including pages with no extracted text.
    return heading ? [heading, text].filter(Boolean).join('\n') : text;
  }).filter(Boolean).join('\n\n');
  return `${title.trim() || 'Untitled'}\n\n${body}\n`;
}

/** True when the note has no typed text at all (a handwriting-only note exports as a backup file instead). */
export const hasText = (pages: NotePage[]) => pages.some((p) => p.text.trim());

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A self-contained page for Print / Save as PDF. Scripts, handlers and links to other sites are removed. */
export function noteToHtml(title: string, pages: NotePage[], opts: { ink?: boolean } = {}): string {
  const clean = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,link').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => {
      for (const a of Array.from(n.attributes)) {
        const attr = a.name.toLowerCase();
        if (attr.startsWith('on') || ['srcdoc', 'srcset', 'action', 'formaction'].includes(attr)) {
          n.removeAttribute(a.name);
          continue;
        }
        if (attr === 'style' && /(?:url\s*\(|expression\s*\(|@import)/i.test(a.value)) {
          n.removeAttribute(a.name);
          continue;
        }
        if (['href', 'src', 'xlink:href'].includes(attr)) {
          const value = a.value.trim();
          if (!/^(?:https?:|mailto:|tel:|\/|#|\.\.?\/)/i.test(value) || /^[\u0000-\u0020]*javascript:/i.test(value)) n.removeAttribute(a.name);
        }
      }
    });
    return doc.body.innerHTML;
  };
  const sections = pages
    .map((p, i) => {
      const h = pageTitle(p, i, pages);
      const body = p.pdf ? `<p>${esc(p.text)}</p>` : clean(pageToHtml(p));
      // Handwriting (optional): drawn as one picture under the page's text, scaled to the page width.
      const inkHtml = opts.ink && p.ink && p.ink.length > 0 ? `<div class="ink">${inkToSvg(p.ink, {})}</div>` : '';
      return body.replace(/<[^>]*>/g, '').trim() || h || inkHtml
        ? `<section>${h ? `<h2 class="pg">${esc(h)}</h2>` : ''}${body}${inkHtml}</section>`
        : '';
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title || 'Untitled')}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.8rem}h2.pg{font-size:.8rem;color:#666;font-weight:600;border-top:1px solid #ddd;padding-top:.6rem;margin-top:2rem}mark{border-radius:3px;padding:0 .1em;color:#111}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3rem .5rem}pre{background:#f4f4f5;padding:.6rem;overflow:auto}img{max-width:100%}@media print{body{margin:0}section{break-inside:avoid-page}}.ink{margin:.8rem 0}.ink svg{display:block;width:100%;height:auto}</style></head><body><h1>${esc(title || 'Untitled')}</h1>${sections}</body></html>`;
}

export function noteToBackupJson(title: string, pages: NotePage[], video?: NoteVideo | null): string {
  return JSON.stringify({ app: 'learning-os-note', version: 1, exportedAt: new Date().toISOString(), title, pages, ...(video ? { video } : {}) });
}

/** A safe file name from the note title. */
export function fileName(title: string, ext: string): string {
  const base = title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'note';
  return `${base}.${ext}`;
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  try {
    document.body.appendChild(a);
    a.click();
  } finally {
    a.remove();
    // Delay revocation so browsers have time to begin reading the download, even when click throws.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
