// src/timestampNode.ts
import { Node, mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { MAX_TIMESTAMP_SECONDS, formatTimestamp, isValidVideoId } from './videoTime';
import './videoTimestamp.css';

export interface VideoTimestampOptions {
  /** Called on click / Enter / Space on a chip. Works while the editor is read-only. */
  onSeek: (seconds: number, videoId: string | null) => void;
  HTMLAttributes: Record<string, unknown>;
}

export interface InsertTimestampOptions {
  seconds: number;
  videoId?: string | null;
  /** Re-focus the editor after inserting (default true). */
  focus?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoTimestamp: {
      /** Inserts a chip + one space after the current selection and puts the cursor after the space. */
      insertTimestamp: (options: InsertTimestampOptions) => ReturnType;
    };
  }
}

const CHIP_SELECTOR = '[data-video-ts]';

function clampSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_TIMESTAMP_SECONDS, Math.max(0, Math.floor(n)));
}

/** null when the attribute is missing / not a finite number. */
function readSeconds(el: Element): number | null {
  const raw = el.getAttribute('data-seconds');
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? clampSeconds(n) : null;
}

function readVideoId(el: Element): string | null {
  const raw = el.getAttribute('data-video-id');
  return isValidVideoId(raw) ? raw : null;
}

function chipFromEvent(event: Event): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const chip = target.closest(CHIP_SELECTOR);
  return chip instanceof HTMLElement ? chip : null;
}

export const VideoTimestamp = Node.create<VideoTimestampOptions>({
  name: 'videoTimestamp',
  group: 'inline',
  inline: true,
  atom: true,
  // Not selectable + not draggable: a stray touch can never pick the chip up and drop it somewhere else.
  selectable: false,
  draggable: false,

  addOptions() {
    return {
      onSeek: () => undefined,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      seconds: {
        default: 0,
        parseHTML: (element: HTMLElement) => readSeconds(element) ?? 0,
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-seconds': String(clampSeconds(attributes.seconds)),
        }),
      },
      videoId: {
        default: null,
        parseHTML: (element: HTMLElement) => readVideoId(element),
        renderHTML: (attributes: Record<string, unknown>) =>
          isValidVideoId(attributes.videoId) ? { 'data-video-id': attributes.videoId } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-video-ts]',
        getAttrs: (node) => (node instanceof HTMLElement && readSeconds(node) !== null ? null : false),
      },
      // Broken chip (e.g. data-seconds="abc"): drop it completely instead of leaving "▶ …" text behind.
      { tag: 'span[data-video-ts]', ignore: true },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const seconds = clampSeconds(node.attrs.seconds);
    return [
      'span',
      mergeAttributes(
        { 'data-video-ts': 'true' },
        this.options.HTMLAttributes,
        HTMLAttributes,
        { class: 'video-ts', role: 'button', tabindex: '0' },
      ),
      `▶ ${formatTimestamp(seconds)}`,
    ];
  },

  renderText({ node }) {
    return `[${formatTimestamp(clampSeconds(node.attrs.seconds))}]`;
  },

  addCommands() {
    return {
      insertTimestamp:
        ({ seconds, videoId = null, focus = true }) =>
        ({ chain, state }) => {
          const content: JSONContent[] = [
            {
              type: this.name,
              attrs: { seconds: clampSeconds(seconds), videoId: isValidVideoId(videoId) ? videoId : null },
            },
            { type: 'text', text: ' ' },
          ];
          const run = chain();
          if (focus) run.focus();
          // Insert AFTER the selection so a selected piece of text is never overwritten.
          // insertContentAt leaves the cursor at the end of what it inserted (after the space).
          return run.insertContentAt(state.selection.to, content).run();
        },
    };
  },

  addKeyboardShortcuts() {
    // Selectable=false means no "select then delete", so Backspace / Delete remove an adjacent chip directly.
    const removeAdjacent = (direction: 'before' | 'after') => () =>
      this.editor.commands.command(({ state, tr }) => {
        const { selection } = state;
        if (!selection.empty) return false;
        const sibling = direction === 'before' ? selection.$from.nodeBefore : selection.$from.nodeAfter;
        if (!sibling || sibling.type.name !== this.name) return false;
        const from = direction === 'before' ? selection.from - sibling.nodeSize : selection.from;
        tr.delete(from, from + sibling.nodeSize);
        return true;
      });

    return { Backspace: removeAdjacent('before'), Delete: removeAdjacent('after') };
  },

  addProseMirrorPlugins() {
    const seek = (chip: HTMLElement): void => {
      const seconds = readSeconds(chip);
      if (seconds === null) return;
      this.options.onSeek(seconds, readVideoId(chip));
    };

    return [
      new Plugin({
        key: new PluginKey('videoTimestampInteraction'),
        props: {
          // DOM-level handlers run even when the editor is NOT editable and don't depend on editor focus.
          handleDOMEvents: {
            // Don't let a tap on a chip move the caret / focus the editor (that would pop the keyboard up).
            mousedown: (_view, event) => {
              if (!chipFromEvent(event)) return false;
              event.preventDefault();
              return true;
            },
            click: (_view, event) => {
              const chip = chipFromEvent(event);
              if (!chip) return false;
              event.preventDefault();
              seek(chip);
              return true;
            },
            // The chip has tabindex=0, so keyboard users reach it with Tab; Enter / Space then activate it.
            keydown: (_view, event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) return false;
              if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return false;
              const chip = chipFromEvent(event);
              if (!chip) return false;
              event.preventDefault();
              if (!event.repeat) seek(chip);
              return true;
            },
            dragstart: (_view, event) => {
              if (!chipFromEvent(event)) return false;
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
});

export default VideoTimestamp;
