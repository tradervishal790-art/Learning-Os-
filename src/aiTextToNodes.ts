// ============================================================
// aiTextToNodes.ts — turn the text an AI tool returns into real editor blocks.
// "Add to note" used to drop every line in as a flat paragraph, so a list of "- " bullets arrived as
// plain lines starting with a dash. Now: "- " / "• " / "* " lines -> bullet list, "1. " lines -> numbered list,
// "# " lines -> heading, **bold** and `code` -> marks. Anything else stays a plain paragraph, line for line.
// ============================================================

export interface EditorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
  text?: string;
  marks?: { type: string }[];
}

const BULLET = /^\s{0,6}(?:[-•*–]|\u2022)\s+(.*)$/;
const ORDERED = /^\s{0,6}\d{1,3}[.)]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;

/** **bold** and `code` become marks; everything else is literal text (single * is NOT italics: it may be math). */
export function inlineNodes(line: string): EditorNode[] {
  const out: EditorNode[] = [];
  const re = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ type: 'text', text: line.slice(last, m.index) });
    out.push({ type: 'text', text: m[1] ?? m[2], marks: [{ type: m[1] !== undefined ? 'bold' : 'code' }] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ type: 'text', text: line.slice(last) });
  return out;
}

const paragraph = (line: string): EditorNode => {
  const content = line.trim() ? inlineNodes(line) : [];
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

export function aiTextToNodes(text: string): EditorNode[] {
  const nodes: EditorNode[] = [];
  let list: EditorNode | null = null; // the open bullet / numbered list
  const closeList = () => { list = null; };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const h = HEADING.exec(raw);
    const b = h ? null : BULLET.exec(raw);
    const o = h || b ? null : ORDERED.exec(raw);
    if (h) {
      closeList();
      nodes.push({ type: 'heading', attrs: { level: h[1].length }, content: inlineNodes(h[2]) });
    } else if (b || o) {
      const kind = b ? 'bulletList' : 'orderedList';
      if (!list || (list as EditorNode).type !== kind) {
        list = { type: kind, content: [] };
        nodes.push(list);
      }
      (list as EditorNode).content!.push({ type: 'listItem', content: [paragraph((b ?? o)![1])] });
    } else {
      closeList();
      nodes.push(paragraph(raw));
    }
  }
  return nodes;
}
