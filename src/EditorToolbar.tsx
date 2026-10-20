import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code, Code2, Eraser, Highlighter, Italic, Link2, List,
  ListChecks, ListOrdered, Maximize2, Minus, Palette, Quote, Redo2, Search, Strikethrough, Subscript as SubIcon,
  Superscript as SupIcon, Table as TableIcon, Underline as UnderlineIcon, Undo2, Volume2, VolumeX, X, Keyboard,
} from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS } from './editorExtensions';
import { Btn, Pop, Swatches, Sep, selectCls } from './toolbarParts';

// ---------- find & replace (inside the active page) ----------

interface Match { from: number; to: number }

function collectMatches(editor: Editor, query: string): Match[] {
  const out: Match[] = [];
  const q = query.toLowerCase();
  if (!q) return out;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // one char per leaf node keeps string offsets aligned with document positions
    const text = node.textBetween(0, node.content.size, undefined, '\ufffc').toLowerCase();
    let i = text.indexOf(q);
    while (i !== -1) {
      out.push({ from: pos + 1 + i, to: pos + 1 + i + q.length });
      i = text.indexOf(q, i + q.length);
    }
    return false;
  });
  return out;
}

function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useTranslation().notebook.editor;
  const [q, setQ] = useState('');
  const [r, setR] = useState('');
  const [cur, setCur] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);

  const refresh = (nextQ: string, nextCur = 0) => {
    const m = collectMatches(editor, nextQ);
    setMatches(m);
    const c = m.length ? Math.min(nextCur, m.length - 1) : 0;
    setCur(c);
    if (m[c]) editor.chain().setTextSelection(m[c]).scrollIntoView().run();
  };

  const go = (d: number) => matches.length && refresh(q, (cur + d + matches.length) % matches.length);

  const replaceOne = () => {
    const m = matches[cur];
    if (!m) return;
    editor.view.dispatch(editor.state.tr.insertText(r, m.from, m.to));
    refresh(q, cur);
  };

  const replaceAll = () => {
    if (!matches.length) return;
    const tr = editor.state.tr;
    [...matches].reverse().forEach((m) => tr.insertText(r, m.from, m.to)); // back to front keeps positions valid
    editor.view.dispatch(tr);
    refresh(q);
  };

  const input = 'h-9 px-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-sm min-w-0 flex-1';
  const small = 'h-9 px-3 rounded-lg text-xs border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10';
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); refresh(e.target.value); }} placeholder={t.findPlaceholder} className={input}
        onKeyDown={(e) => e.key === 'Enter' && go(e.shiftKey ? -1 : 1)} />
      <input value={r} onChange={(e) => setR(e.target.value)} placeholder={t.replacePlaceholder} className={input} />
      <span className="text-xs text-gray-500 dark:text-white/60 min-w-16 text-center">
        {q ? (matches.length ? format(t.matchCount, cur + 1, matches.length) : t.noMatches) : ''}
      </span>
      <button className={small} onClick={() => go(-1)}>{t.prev}</button>
      <button className={small} onClick={() => go(1)}>{t.next}</button>
      <button className={small} onClick={replaceOne}>{t.replace}</button>
      <button className={small} onClick={replaceAll}>{t.replaceAll}</button>
      <Btn label={t.close} onClick={onClose}><X size={16} /></Btn>
    </div>
  );
}

// ---------- toolbar ----------

export default function EditorToolbar({
  editor, onFocusMode, section = 'all', lead, extra,
}: {
  editor: Editor | null;
  onFocusMode: () => void;
  /** 'all' = the single desktop row; the others are the phone ribbon tabs. */
  section?: 'all' | 'home' | 'insert' | 'view';
  lead?: ReactNode;
  extra?: ReactNode;
}) {
  const t = useTranslation().notebook.editor;
  const [finding, setFinding] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  // stop reading if the student leaves the note
  useEffect(() => () => void window.speechSynthesis?.cancel(), []);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: !!e?.isActive('bold'),
      italic: !!e?.isActive('italic'),
      underline: !!e?.isActive('underline'),
      strike: !!e?.isActive('strike'),
      code: !!e?.isActive('code'),
      sub: !!e?.isActive('subscript'),
      sup: !!e?.isActive('superscript'),
      bullet: !!e?.isActive('bulletList'),
      ordered: !!e?.isActive('orderedList'),
      task: !!e?.isActive('taskList'),
      quote: !!e?.isActive('blockquote'),
      codeBlock: !!e?.isActive('codeBlock'),
      link: !!e?.isActive('link'),
      table: !!e?.isActive('table'),
      highlight: !!e?.isActive('highlight'),
      left: !!e?.isActive({ textAlign: 'left' }),
      center: !!e?.isActive({ textAlign: 'center' }),
      right: !!e?.isActive({ textAlign: 'right' }),
      heading: e?.isActive('heading', { level: 1 }) ? '1' : e?.isActive('heading', { level: 2 }) ? '2' : e?.isActive('heading', { level: 3 }) ? '3' : 'p',
      size: (e?.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      canUndo: !!e?.can().undo(),
      canRedo: !!e?.can().redo(),
    }),
  });

  if (!editor || !s) return <div className="h-11" />;
  const c = () => editor.chain().focus();

  const setHeading = (v: string) => (v === 'p' ? c().setParagraph().run() : c().toggleHeading({ level: Number(v) as 1 | 2 | 3 }).run());
  const setSize = (v: string) => (v ? c().setFontSize(v).run() : c().unsetFontSize().run());
  const setFont = (v: string) => (v ? c().setFontFamily(v).run() : c().unsetFontFamily().run());

  const addLink = () => {
    if (s.link) return void c().extendMarkRange('link').unsetLink().run();
    const href = window.prompt(t.linkPrompt, 'https://');
    if (!href || href === 'https://') return;
    c().extendMarkRange('link').setLink({ href }).run();
  };

  const readAloud = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speakingRef.current) {
      synth.cancel();
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    const { from, to } = editor.state.selection;
    const text = (from !== to ? editor.state.doc.textBetween(from, to, '\n') : editor.getText({ blockSeparator: '\n' })).trim();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    if (/[\u0900-\u097F]/.test(text)) u.lang = 'hi-IN'; // Devanagari text -> Hindi voice
    u.onend = u.onerror = () => {
      speakingRef.current = false;
      setSpeaking(false);
    };
    speakingRef.current = true;
    setSpeaking(true);
    synth.speak(u);
  };

  const shortcuts: [string, string][] = [
    ['Ctrl+B', t.bold], ['Ctrl+I', t.italic], ['Ctrl+U', t.underline], ['Ctrl+Shift+S', t.strike],
    ['Ctrl+Shift+H', t.highlight], ['Ctrl+Z', t.undo], ['Ctrl+Shift+Z', t.redo],
    ['Ctrl+Shift+8', t.bulletList], ['Ctrl+Shift+7', t.numberedList], ['Ctrl+Shift+9', t.checklist],
    ['Ctrl+Alt+1/2/3', t.heading1 + ' / 2 / 3'], ['Ctrl+Shift+L/E/R', `${t.alignLeft} / ${t.alignCenter} / ${t.alignRight}`],
  ];

  const history = (
    <>
        <Btn label={t.undo} disabled={!s.canUndo} onClick={() => c().undo().run()}><Undo2 size={16} /></Btn>
        <Btn label={t.redo} disabled={!s.canRedo} onClick={() => c().redo().run()}><Redo2 size={16} /></Btn>
    </>
  );
  const selects = (
    <>
        <select aria-label={t.normalText} className={selectCls} value={s.heading} onChange={(e) => setHeading(e.target.value)}>
          <option value="p">{t.normalText}</option>
          <option value="1">{t.heading1}</option>
          <option value="2">{t.heading2}</option>
          <option value="3">{t.heading3}</option>
        </select>
        <select aria-label="Font" className={`${selectCls} ml-1`} defaultValue="" onChange={(e) => setFont(e.target.value)}>
          <option value="">Sans</option>
          <option value="Georgia, serif">Serif</option>
          <option value="ui-monospace, monospace">Mono</option>
          <option value="'Comic Sans MS', cursive">Hand</option>
        </select>
        <select aria-label={t.fontSize} title={t.fontSize} className={`${selectCls} ml-1`} value={FONT_SIZES.includes(s.size as never) ? s.size : ''} onChange={(e) => setSize(e.target.value)}>
          <option value="">{t.sizeNormal}</option>
          <option value={FONT_SIZES[0]}>{t.sizeSmall}</option>
          <option value={FONT_SIZES[2]}>{t.sizeLarge}</option>
          <option value={FONT_SIZES[3]}>{t.sizeHuge}</option>
        </select>
    </>
  );
  const marks = (
    <>
        <Btn label={t.bold} active={s.bold} onClick={() => c().toggleBold().run()}><Bold size={16} /></Btn>
        <Btn label={t.italic} active={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={16} /></Btn>
        <Btn label={t.underline} active={s.underline} onClick={() => c().toggleUnderline().run()}><UnderlineIcon size={16} /></Btn>
        <Btn label={t.strike} active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough size={16} /></Btn>
        <Btn label={t.superscript} active={s.sup} onClick={() => c().toggleSuperscript().run()}><SupIcon size={16} /></Btn>
        <Btn label={t.subscript} active={s.sub} onClick={() => c().toggleSubscript().run()}><SubIcon size={16} /></Btn>
        <Pop trigger={(toggle) => <Btn label={t.textColor} onClick={toggle}><Palette size={16} /></Btn>}>
          <Swatches colors={TEXT_COLORS} onPick={(col) => c().setColor(col).run()} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().unsetColor().run()} className="mt-2 text-xs underline text-gray-600 dark:text-white/70">{t.resetColor}</button>
        </Pop>
        <Pop trigger={(toggle) => <Btn label={t.highlight} active={s.highlight} onClick={toggle}><Highlighter size={16} /></Btn>}>
          <Swatches colors={HIGHLIGHT_COLORS} onPick={(col) => c().setHighlight({ color: col }).run()} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().unsetHighlight().run()} className="mt-2 text-xs underline text-gray-600 dark:text-white/70">{t.removeHighlight}</button>
        </Pop>
        <Btn label={t.clearFormat} onClick={() => c().unsetAllMarks().clearNodes().run()}><Eraser size={16} /></Btn>
    </>
  );
  const lists = (
    <>
        <Btn label={t.bulletList} active={s.bullet} onClick={() => c().toggleBulletList().run()}><List size={16} /></Btn>
        <Btn label={t.numberedList} active={s.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
        <Btn label={t.checklist} active={s.task} onClick={() => c().toggleTaskList().run()}><ListChecks size={16} /></Btn>
    </>
  );
  const blocks = (
    <>
        <Btn label={t.quote} active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></Btn>
        <Btn label={t.inlineCode} active={s.code} onClick={() => c().toggleCode().run()}><Code size={16} /></Btn>
        <Btn label={t.codeBlock} active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}><Code2 size={16} /></Btn>
        <Btn label={t.link} active={s.link} onClick={addLink}><Link2 size={16} /></Btn>
        <Btn label={t.divider} onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></Btn>
    </>
  );
  const align = (
    <>
        <Btn label={t.alignLeft} active={s.left} onClick={() => c().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
        <Btn label={t.alignCenter} active={s.center} onClick={() => c().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
        <Btn label={t.alignRight} active={s.right} onClick={() => c().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
    </>
  );
  const tableBtn = (
    <>
        <Btn label={t.table} active={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={16} /></Btn>
    </>
  );
  const tools = (
    <>
        <Btn label={t.find} active={finding} onClick={() => setFinding((f) => !f)}><Search size={16} /></Btn>
        <Btn label={speaking ? t.stopReading : t.readAloud} active={speaking} onClick={readAloud}>{speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}</Btn>
        <Btn label={t.focusMode} onClick={onFocusMode}><Maximize2 size={16} /></Btn>
    </>
  );
  const shortcutsBtn = (
    <>
        <Pop trigger={(toggle) => <Btn label={t.shortcuts} onClick={toggle}><Keyboard size={16} /></Btn>}>
          <div className="text-xs space-y-1 py-1 pr-2">
            <div className="font-medium mb-1">{t.shortcutsTitle}</div>
            {shortcuts.map(([k, label]) => (
              <div key={k} className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-white/70">{label}</span>
                <kbd className="font-mono text-gray-500 dark:text-white/50">{k}</kbd>
              </div>
            ))}
          </div>
        </Pop>
    </>
  );

  // Desktop shows everything in one row; the phone ribbon shows one tab's worth at a time.
  const row =
    section === 'home' ? (
      <>{history}<Sep />{selects}<Sep />{marks}<Sep />{lists}<Sep />{align}</>
    ) : section === 'insert' ? (
      <>{blocks}<Sep />{tableBtn}</>
    ) : section === 'view' ? (
      <>{tools}</>
    ) : (
      <>{history}<Sep />{selects}<Sep />{marks}<Sep />{lists}{blocks}<Sep />{align}<Sep />{tableBtn}<Sep />{tools}{shortcutsBtn}</>
    );

  return (
    <div>
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {lead}
        {row}
        {extra}
      </div>

      {s.table && (
        <div className="flex flex-wrap gap-1 pt-1">
          {[
            [t.addRow, () => c().addRowAfter().run()],
            [t.addColumn, () => c().addColumnAfter().run()],
            [t.deleteRow, () => c().deleteRow().run()],
            [t.deleteColumn, () => c().deleteColumn().run()],
            [t.deleteTable, () => c().deleteTable().run()],
          ].map(([label, fn]) => (
            <button key={label as string} type="button" onMouseDown={(e) => e.preventDefault()} onClick={fn as () => void}
              className="h-8 px-2.5 rounded-lg text-xs border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10">
              {label as string}
            </button>
          ))}
        </div>
      )}

      {finding && <FindBar editor={editor} onClose={() => setFinding(false)} />}
    </div>
  );
}
