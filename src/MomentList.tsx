// src/MomentList.tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, HelpCircle, Pencil, RotateCcw, Star, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { activeMomentId, formatTimestamp, sortMoments } from './videoTime';
import type { MomentKind, VideoMoment } from './videoTime';

export interface MomentListProps {
  moments: VideoMoment[];
  currentSeconds?: number;
  labels: {
    title: string;
    empty: string;
    all: string;
    kinds: Record<MomentKind, string>;
    editNote: string;
    saveNote: string;
    cancel: string;
    remove: string;
    notePlaceholder: string;
  };
  onSeek(seconds: number): void;
  onDelete(id: string): void;
  onEditNote(id: string, note: string): void;
}

type Filter = 'all' | MomentKind;

const KINDS: readonly MomentKind[] = ['confusing', 'important', 'revisit'];
const KIND_ICON: Record<MomentKind, LucideIcon> = {
  confusing: HelpCircle,
  important: Star,
  revisit: RotateCcw,
};

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white';
const CHIP = `inline-flex min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-white/10 ${FOCUS}`;
const CHIP_ON = 'bg-black text-white dark:bg-white dark:text-black';
const CHIP_OFF = 'bg-white text-black dark:bg-black dark:text-white';
const ICON_BTN = `inline-flex min-h-[36px] min-w-[36px] items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 text-xs text-black dark:border-white/10 dark:bg-black dark:text-white ${FOCUS}`;

export default function MomentList({
  moments,
  currentSeconds,
  labels,
  onSeek,
  onDelete,
  onEditNote,
}: MomentListProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const listRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const editRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  const sorted = useMemo(() => sortMoments(moments), [moments]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: sorted.length, confusing: 0, important: 0, revisit: 0 };
    for (const moment of sorted) result[moment.kind] += 1;
    return result;
  }, [sorted]);

  const visible = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((moment) => moment.kind === filter)),
    [sorted, filter],
  );

  const activeId = useMemo(
    () => (currentSeconds === undefined ? null : activeMomentId(sorted, currentSeconds)),
    [sorted, currentSeconds],
  );

  // Scroll the active row into view — only if the LIST itself scrolls and the row is outside its viewport.
  // We scroll the list element directly (scrollIntoView could also scroll the page / notes pane).
  useEffect(() => {
    if (activeId === null || editingId !== null) return;
    const list = listRef.current;
    const row = rowRefs.current.get(activeId);
    if (!list || !row) return;
    if (list.scrollHeight <= list.clientHeight + 1) return; // list isn't scrollable

    const listBox = list.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (rowBox.top >= listBox.top && rowBox.bottom <= listBox.bottom) return; // already visible

    const target = list.scrollTop + (rowBox.top - listBox.top) - (list.clientHeight - rowBox.height) / 2;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    list.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeId, editingId, filter]);

  // Focus the textarea (caret at the end) when a row enters edit mode.
  useEffect(() => {
    if (editingId === null) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editingId]);

  const startEdit = (moment: VideoMoment): void => {
    setEditingId(moment.id);
    setDraft(moment.note);
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setDraft('');
  };

  const saveEdit = (moment: VideoMoment): void => {
    const next = draft.trim();
    if (next !== moment.note) onEditNote(moment.id, next);
    cancelEdit();
  };

  const onDraftKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>, moment: VideoMoment): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      saveEdit(moment);
    }
  };

  const chips: { key: Filter; text: string }[] = [
    { key: 'all', text: labels.all },
    ...KINDS.map((kind) => ({ key: kind, text: labels.kinds[kind] })),
  ];

  return (
    <section aria-labelledby={titleId} className="flex h-full min-h-0 flex-col gap-3">
      <h2 id={titleId} className="text-sm font-semibold text-black dark:text-white">
        {labels.title}
      </h2>

      <div role="group" aria-labelledby={titleId} className="flex flex-wrap gap-2">
        {chips.map(({ key, text }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`${CHIP} ${filter === key ? CHIP_ON : CHIP_OFF}`}
          >
            <span>{text}</span>
            <span className="tabular-nums">{counts[key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-gray-200 p-4 text-sm text-black dark:border-white/10 dark:text-white">
          {labels.empty}
        </p>
      ) : (
        <ul ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {visible.map((moment) => {
            const Icon = KIND_ICON[moment.kind];
            const isActive = moment.id === activeId;
            const isEditing = moment.id === editingId;

            return (
              <li
                key={moment.id}
                ref={(el: HTMLLIElement | null) => {
                  if (el) rowRefs.current.set(moment.id, el);
                  else rowRefs.current.delete(moment.id);
                }}
                aria-current={isActive ? 'true' : undefined}
                className={`rounded-xl border p-3 text-black dark:text-white ${
                  isActive
                    ? 'border-black bg-gray-100 ring-2 ring-black dark:border-white dark:bg-white/10 dark:ring-white'
                    : 'border-gray-200 bg-white dark:border-white/10 dark:bg-black'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onSeek(moment.seconds)}
                    className={`min-h-[36px] min-w-[56px] shrink-0 rounded-lg border border-gray-200 bg-white px-2 font-mono text-sm tabular-nums text-black dark:border-white/10 dark:bg-black dark:text-white ${FOCUS}`}
                  >
                    {formatTimestamp(moment.seconds)}
                  </button>

                  <div className="min-w-0 flex-1">
                    {/* Kind = icon + text, never colour alone */}
                    <p className="flex min-h-[36px] items-center gap-1.5 text-xs font-medium">
                      <Icon size={14} aria-hidden="true" />
                      <span>{labels.kinds[moment.kind]}</span>
                    </p>

                    {isEditing ? (
                      <textarea
                        ref={editRef}
                        value={draft}
                        rows={3}
                        placeholder={labels.notePlaceholder}
                        aria-label={labels.editNote}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => onDraftKeyDown(event, moment)}
                        // 16px: iOS/iPadOS Safari zooms the page on focus for smaller input text.
                        className={`mt-1 w-full resize-y rounded-lg border border-gray-200 bg-white p-2 text-base text-black dark:border-white/10 dark:bg-black dark:text-white ${FOCUS}`}
                      />
                    ) : moment.note !== '' ? (
                      <p className="whitespace-pre-wrap break-words text-sm">{moment.note}</p>
                    ) : null}
                  </div>

                  {!isEditing && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(moment)}
                        aria-label={labels.editNote}
                        title={labels.editNote}
                        className={ICON_BTN}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(moment.id)}
                        aria-label={labels.remove}
                        title={labels.remove}
                        className={ICON_BTN}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={cancelEdit} className={`${ICON_BTN} px-3`}>
                      <X size={16} aria-hidden="true" />
                      <span>{labels.cancel}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(moment)}
                      className={`${ICON_BTN} border-black bg-black px-3 text-white dark:border-white dark:bg-white dark:text-black`}
                    >
                      <Check size={16} aria-hidden="true" />
                      <span>{labels.saveNote}</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
