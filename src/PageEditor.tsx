import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { buildExtensions } from './editorExtensions';
import { pageToHtml, type InkStroke, type NotePage, type PageAttachment } from './notebookStore';
import type { InkMode, InkPrefs } from './inkPrefs';
import { PAGE_RATIO, PAGE_UNITS, TEXT_REF_WIDTH, inkExtentY } from './inkEngine';
import { pickStrokes, selectInPolygon } from './inkEdit';
import InkLayer from './InkLayer';
import PageBackground from './PageBackground';
import PageAttachments, { isFloating, requestAttach } from './PageAttachments';
import PageImages from './PageImages';
import { isTemplateId, paperIsDark, textLineUnits } from './pageTemplates';
import { useAppDark } from './useAppDark';
import './noteEditor.css';

/** One page "sheet": highlights under the text, rich text in the middle, pen ink on top. */
/** What the AI pen found inside a loop on one page. Pictures are only referenced by id; they are read later, after consent. */
export interface CircleCapture {
  pageId: string;
  typed: string;
  ink: InkStroke[];
  imageIds: string[];
}

type ClientBox = { x0: number; y0: number; x1: number; y1: number };

/** True when the loop and the element share a meaningful area (so a sliver at the edge does not drag a whole block in). */
function overlaps(el: Element, b: ClientBox): boolean {
  const r = el.getBoundingClientRect();
  const w = Math.min(r.right, b.x1) - Math.max(r.left, b.x0);
  const h = Math.min(r.bottom, b.y1) - Math.max(r.top, b.y0);
  if (w <= 0 || h <= 0) return false;
  const smaller = Math.min(r.width * r.height, (b.x1 - b.x0) * (b.y1 - b.y0));
  return smaller > 0 && (w * h) / smaller >= 0.3;
}

export default function PageEditor({
  page,
  strokes,
  placeholder,
  autoFocus,
  primary,
  mode,
  prefs,
  zoom,
  selectedIds,
  onChange,
  onActive,
  onEditor,
  onInk,
  onSelect,
  onAttachments,
  attachLabels,
  onSeekVideo,
  onCircle,
  recall = false,
}: {
  page: NotePage;
  strokes: InkStroke[];
  placeholder: string;
  autoFocus: boolean;
  /** First page: becomes the toolbar's target on open. */
  primary: boolean;
  mode: InkMode;
  prefs: InkPrefs;
  /** 1 = fit width. Text scales with the sheet, so zooming behaves like zooming a real page. */
  zoom: number;
  selectedIds: string[];
  onChange: (pageId: string, html: string, text: string) => void;
  onActive: (editor: Editor, pageId: string) => void;
  onEditor: (pageId: string, editor: Editor) => void;
  onInk: (pageId: string, next: InkStroke[]) => void;
  onSelect: (pageId: string, ids: string[]) => void;
  onAttachments: (pageId: string, next: PageAttachment[]) => void;
  attachLabels: Record<string, string>;
  /** A time chip in the text was clicked (Part 7). */
  onSeekVideo?: (seconds: number, videoId: string | null) => void;
  /** AI pen: the student drew a loop on this page. */
  onCircle?: (capture: CircleCapture) => void;
  /** Recall mode: read-only, highlights are covered (see noteEditor.css). */
  recall?: boolean;
}) {
  const seekRef = useRef(onSeekVideo);
  useEffect(() => {
    seekRef.current = onSeekVideo;
  });
  const editor = useEditor({
    // The editor is created once, so the chip handler reads the newest callback through a ref.
    extensions: buildExtensions(placeholder, (sec, vid) => seekRef.current?.(sec, vid)),
    content: pageToHtml(page),
    editorProps: { attributes: { class: 'note-prose' } },
    onUpdate: ({ editor: ed }) => onChange(page.id, ed.getHTML(), ed.getText({ blockSeparator: '\n' })),
    onFocus: ({ editor: ed }) => onActive(ed, page.id),
  });

  useEffect(() => {
    if (!editor) return;
    onEditor(page.id, editor);
    if (autoFocus) editor.commands.focus('end');
    else if (primary) onActive(editor, page.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Typing and drawing never fight: the text is read-only while a pen tool is active.
  useEffect(() => {
    // `false` = do not announce an "update": switching tools (or opening the note) is not an edit,
    // so it must not light up Save, trigger an autosave or show a "discard changes?" prompt.
    editor?.setEditable(mode === 'type' && !recall, false);
  }, [editor, mode, recall]);

  // The sheet's size drives the ink canvases; ink and text share one coordinate space.
  const sheet = useRef<HTMLDivElement>(null);
  // Drag photos from the computer onto the page: it shows a drop frame, then adds them.
  const [dropping, setDropping] = useState(false);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = size.w / PAGE_UNITS;
  const extent = useMemo(() => inkExtentY(strokes), [strokes]);
  // At least an A4 sheet; grows when handwriting reaches the bottom.
  // Photos placed on the page also push the sheet's bottom edge down.
  const imageExtent = (page.attachments ?? []).reduce((m, a) => (isFloating(a) ? Math.max(m, (a.y ?? 0) + (a.w ?? 0) * (a.ar ?? 0.75)) : m), 0);
  const minHeight = size.w > 0 ? Math.max(size.w * PAGE_RATIO, Math.max(extent, imageExtent) * scale + 160) : undefined;

  // 1 when the page is at the reference width; same factor the ink uses. Before the first measure, fall back to zoom.
  const textK = size.w > 0 ? size.w / TEXT_REF_WIDTH : zoom;

  const appDark = useAppDark();
  const template = isTemplateId(page.template) ? page.template : 'blank';
  const darkPaper = paperIsDark(page.paper, appDark);
  // One typed line = one ruled line (px). 0 on pages without lines, where text keeps its free spacing.
  const linePx = size.w > 0 ? textLineUnits(template) * (size.w / PAGE_UNITS) : 0;

  return (
    <div
      ref={sheet}
      // Text size follows the PAGE width (not the screen), so typed text, ruled lines and ink always stay in the same place.
      // Padding is in em so it scales with the text too. --note-px is "1 text px" for sized text (PowerPoint-style sizes).
      // On lined / grid paper the first line also starts half a line down, so the text sits ON the rule instead of straddling it (see noteEditor.css).
      style={{
        minHeight,
        padding: '1em',
        ...(linePx > 0 ? { paddingTop: 'max(0px, calc(var(--note-line) / 2 - 0.47em))', ['--note-line' as string]: `${linePx}px` } : {}),
        fontSize: `${16 * textK}px`,
        ['--note-px' as string]: `${textK}px`,
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); // never let the browser open the file instead
        setDropping(false);
        const photos = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (photos.length > 0) requestAttach(page.id, 'photo', photos);
      }}
      className={`relative isolate rounded-2xl border bg-white dark:bg-white/5 focus-within:border-gray-400 dark:focus-within:border-white/30 ${linePx > 0 ? 'note-gridded' : ''} ${
        dropping ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-gray-200 dark:border-white/10'
      } ${darkPaper ? 'note-paper-dark' : ''}`}
    >
      {dropping && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-sm font-medium text-indigo-700 dark:text-indigo-200">
          {attachLabels.dropHere ?? 'Drop photos here'}
        </div>
      )}
      {size.w > 0 && <PageBackground template={template} paper={page.paper} width={size.w} height={size.h} dark={appDark} />}
      <div className="relative z-10">
        <EditorContent editor={editor} />
      </div>
      <PageAttachments pageId={page.id} attachments={page.attachments ?? []} onChange={(next) => onAttachments(page.id, next)} labels={attachLabels} layoutScale={size.w > 0 ? size.w / TEXT_REF_WIDTH : 1} />
      {size.w > 0 && (
        <PageImages attachments={page.attachments ?? []} width={size.w} onChange={(next) => onAttachments(page.id, next)} labels={attachLabels} />
      )}
      {size.w > 0 && (
        <InkLayer
          strokes={strokes}
          width={size.w}
          height={size.h}
          mode={mode}
          prefs={prefs}
          paperDark={darkPaper}
          selectedIds={selectedIds}
          onSelect={(ids) => onSelect(page.id, ids)}
          onCommit={(next) => onInk(page.id, next)}
          onActivate={() => editor && onActive(editor, page.id)}
          onCircle={
            onCircle
              ? ({ poly, client }) => {
                  const blocks = Array.from(editor?.view.dom.children ?? []).filter((el) => overlaps(el, client));
                  const typed = blocks.map((el) => (el as HTMLElement).innerText.trim()).filter(Boolean).join('\n');
                  const figures = Array.from(sheet.current?.querySelectorAll<HTMLElement>('figure[data-attach-id]') ?? []);
                  const imageIds = figures.filter((f) => overlaps(f, client)).map((f) => f.dataset.attachId ?? '').filter(Boolean);
                  const ink = pickStrokes(strokes, new Set(selectInPolygon(strokes, poly)));
                  onCircle({ pageId: page.id, typed, ink, imageIds });
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
