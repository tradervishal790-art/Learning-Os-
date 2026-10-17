import StarterKit from '@tiptap/starter-kit';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { VideoTimestamp } from './timestampNode';

/** Everything the typed editor supports. Content is parsed through this
 *  schema on load, so HTML coming from the cloud can't smuggle in scripts. */
export function buildExtensions(placeholder: string, onSeek?: (seconds: number, videoId: string | null) => void) {
  return [
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
export const FONT_SIZES = ['13px', '16px', '20px', '26px'] as const;
