import StarterKit from '@tiptap/starter-kit';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState } from '@tiptap/pm/state';
import type { Mark } from '@tiptap/pm/model';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { VideoTimestamp } from './timestampNode';

/**
 * Typing style memory. The font / size / colour / bold the student chose lives only on the text itself, so
 * when the line becomes empty (select + delete, Ctrl+A + delete, or Backspace down to nothing) ProseMirror has
 * nothing left to take the style from and the next letter comes out in the default font.
 * This remembers the style that was last in effect and puts it back as the "typing style" of an empty line.
 * An explicit choice (stored marks, e.g. "no font") always wins over the memory.
 */
const typingMarksKey = new PluginKey<readonly Mark[]>('typingMarks');

/** Marks that should follow the student's typing. Links and inline code must not leak into new text. */
const isTypingMark = (m: Mark): boolean => m.type.spec.inclusive !== false && m.type.name !== 'link' && m.type.name !== 'code';

function marksInEffect(state: EditorState): readonly Mark[] | null {
  if (state.storedMarks) return state.storedMarks.filter(isTypingMark);
  const { selection } = state;
  if (!selection.empty) {
    let found: readonly Mark[] | null = null;
    state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (found) return false;
      if (node.isText) found = node.marks;
      return true;
    });
    return found ? (found as readonly Mark[]).filter(isTypingMark) : null;
  }
  const $from = selection.$from;
  if ($from.parent.isTextblock && $from.parent.content.size === 0) return null; // an empty line says nothing new
  return $from.marks().filter(isTypingMark);
}

const PreserveTypingMarks = Extension.create({
  name: 'preserveTypingMarks',
  addProseMirrorPlugins() {
    return [
      new Plugin<readonly Mark[]>({
        key: typingMarksKey,
        state: {
          init: () => [],
          apply: (_tr, value, _old, next) => marksInEffect(next) ?? value,
        },
        appendTransaction(transactions, _oldState, newState) {
          if (!newState.selection.empty || newState.storedMarks) return null; // an explicit choice is never overridden
          if (!transactions.some((tr) => tr.docChanged || tr.selectionSet)) return null;
          const $from = newState.selection.$from;
          if (!$from.parent.isTextblock || $from.parent.content.size !== 0) return null;
          const remembered = typingMarksKey.getState(newState) ?? [];
          if (remembered.length === 0) return null;
          return newState.tr.setStoredMarks(remembered.slice());
        },
      }),
    ];
  },
});

/** Everything the typed editor supports. Content is parsed through this
 *  schema on load, so HTML coming from the cloud can't smuggle in scripts. */
export function buildExtensions(placeholder: string, onSeek?: (seconds: number, videoId: string | null) => void) {
  return [
    PreserveTypingMarks,
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder }),
    // Lecture-video time chips (Part 7). Clicking one seeks the linked video.
    VideoTimestamp.configure({ onSeek: (s, v) => onSeek?.(s, v) }),
  ];
}

// Mid-tone colours that stay readable on BOTH light and dark pages. Black/white = the "Default colour" reset, which follows the theme.
export const TEXT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c', '#b45309', '#0d9488', '#db2777', '#6b7280', '#0891b2'];
/** The four meaning-colours (Part 6 filters notes by these). */
export const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#f9a8d4', '#93c5fd'];

/** Font list in the style of Word / PowerPoint. Only fonts that ship with Windows / macOS / Android
 *  (plus a generic fallback), so notes work offline and nothing has to be downloaded.
 *  Georgia / Comic Sans / ui-monospace keep their old values so notes saved earlier still match. */
export const FONT_GROUPS: { label: string; fonts: { label: string; value: string }[] }[] = [
  { label: 'Sans-serif', fonts: [
    { label: 'Calibri', value: "Calibri, 'Segoe UI', sans-serif" },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Segoe UI', value: "'Segoe UI', Roboto, sans-serif" },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
    { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
    { label: 'Century Gothic', value: "'Century Gothic', 'Apple Gothic', sans-serif" },
  ] },
  { label: 'Serif', fonts: [
    { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Cambria', value: 'Cambria, Georgia, serif' },
    { label: 'Garamond', value: "Garamond, 'Times New Roman', serif" },
    { label: 'Palatino Linotype', value: "'Palatino Linotype', Palatino, serif" },
  ] },
  { label: 'Monospace', fonts: [
    { label: 'Consolas', value: 'Consolas, monospace' },
    { label: 'Courier New', value: "'Courier New', Courier, monospace" },
    { label: 'Monospace (system)', value: 'ui-monospace, monospace' },
  ] },
  { label: 'Handwriting & display', fonts: [
    { label: 'Comic Sans MS', value: "'Comic Sans MS', cursive" },
    { label: 'Segoe Print', value: "'Segoe Print', 'Bradley Hand', cursive" },
    { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
  ] },
  { label: 'Devanagari (हिंदी)', fonts: [
    { label: 'Nirmala UI', value: "'Nirmala UI', 'Noto Sans Devanagari', sans-serif" },
    { label: 'Mangal', value: "Mangal, 'Noto Sans Devanagari', serif" },
  ] },
];
export const ALL_FONTS = FONT_GROUPS.flatMap((g) => g.fonts);

/** Sizes offered in the size list (same ladder as PowerPoint, in points-ish px). */
export const SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 80, 96];
/** Size of normal body text (the editor's base font-size). */
export const BASE_SIZE = 16;
export const MIN_SIZE = 1;
export const MAX_SIZE = 400;

/**
 * A size is stored as `calc(N * var(--note-px, 1px))`. The page sets --note-px to its zoom, so sized text
 * zooms together with the page (a plain `20px` stayed 20px while zooming, so it ended up smaller than the
 * body text). Outside the editor (exports, thumbnails) the variable is missing and the 1px fallback makes it N px.
 */
export function sizeToCss(n: number): string {
  return `calc(${n} * var(--note-px, 1px))`;
}
/** Reads a stored size (new calc form, or the older plain px form) back to a number; null = default size. */
export function cssToSize(v: string | undefined | null): number | null {
  if (!v) return null;
  const m = /^calc\(\s*(\d+(?:\.\d+)?)\s*\*\s*var\(\s*--note-px\s*,\s*1px\s*\)\s*\)$/.exec(v.trim()) ?? /^(\d+(?:\.\d+)?)px$/.exec(v.trim());
  return m ? Number(m[1]) : null;
}
/** Next size up / down the ladder, like PowerPoint's grow / shrink font buttons. */
export function stepSize(cur: number, dir: 1 | -1): number {
  const next = dir === 1 ? SIZE_PRESETS.find((p) => p > cur) : [...SIZE_PRESETS].reverse().find((p) => p < cur);
  if (next !== undefined) return next;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, cur + dir * (dir === 1 ? 8 : 1)));
}
