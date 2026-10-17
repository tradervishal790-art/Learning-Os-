import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { buildExtensions } from './editorExtensions';
import { pageToHtml, type InkStroke, type NotePage, type PageAttachment } from './notebookStore';
import type { InkMode, InkPrefs } from './inkPrefs';
import { PAGE_RATIO, PAGE_UNITS, inkExtentY } from './inkEngine';
import InkLayer from './InkLayer';
import PageBackground from './PageBackground';
import PageAttachments from './PageAttachments';
import { isTemplateId, paperIsDark } from './pageTemplates';
import { useAppDark } from './useAppDark';
import './noteEditor.css';

/** One page "sheet": highlights under the text, rich text in the middle, pen ink on top. */
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
    editor?.setEditable(mode === 'type');
  }, [editor, mode]);

  // The sheet's size drives the ink canvases; ink and text share one coordinate space.
  const sheet = useRef<HTMLDivElement>(null);
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
  const minHeight = size.w > 0 ? Math.max(size.w * PAGE_RATIO, extent * scale + 160) : undefined;

  const appDark = useAppDark();
  const template = isTemplateId(page.template) ? page.template : 'blank';
  const darkPaper = paperIsDark(page.paper, appDark);

  return (
    <div
      ref={sheet}
      style={{ minHeight, fontSize: `${16 * zoom}px` }}
      className={`relative isolate p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 focus-within:border-gray-400 dark:focus-within:border-white/30 ${
        darkPaper ? 'note-paper-dark' : ''
      }`}
    >
      {size.w > 0 && <PageBackground template={template} paper={page.paper} width={size.w} height={size.h} dark={appDark} />}
      <div className="relative z-10">
        <EditorContent editor={editor} />
      </div>
      <PageAttachments attachments={page.attachments ?? []} onChange={(next) => onAttachments(page.id, next)} labels={attachLabels} />
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
        />
      )}
    </div>
  );
}
