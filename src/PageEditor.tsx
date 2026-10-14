import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { buildExtensions } from './editorExtensions';
import { pageToHtml, type NotePage } from './notebookStore';
import './noteEditor.css';

/** One rich-text page. Emits html + plain-text mirror on every real edit. */
export default function PageEditor({
  page,
  placeholder,
  autoFocus,
  primary,
  onChange,
  onActive,
}: {
  page: NotePage;
  placeholder: string;
  autoFocus: boolean;
  /** First page: becomes the toolbar's target on open. */
  primary: boolean;
  onChange: (pageId: string, html: string, text: string) => void;
  onActive: (editor: Editor) => void;
}) {
  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: pageToHtml(page),
    editorProps: { attributes: { class: 'note-prose' } },
    onUpdate: ({ editor: ed }) => onChange(page.id, ed.getHTML(), ed.getText({ blockSeparator: '\n' })),
    onFocus: ({ editor: ed }) => onActive(ed),
  });

  useEffect(() => {
    if (!editor) return;
    if (autoFocus) editor.commands.focus('end');
    else if (primary) onActive(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 focus-within:border-gray-400 dark:focus-within:border-white/30">
      <EditorContent editor={editor} />
    </div>
  );
}
