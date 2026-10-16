// src/PageThumbnails.tsx
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import type { InkStroke } from './notebookStore';
import { drawLayer, PAGE_RATIO, PAGE_UNITS } from './inkEngine';
import { PAGE_TEMPLATES, PAPER_COLORS, paperColor, paperIsDark } from './pageTemplates';
import type { PageTemplateId } from './pageTemplates';
import PageBackground from './PageBackground';
import { dropIndexFromY, moveTargetIndex } from './pageDrag';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export interface PageThumbnailsProps {
  pages: {
    id: string;
    strokes: InkStroke[];
    template?: PageTemplateId;
    paper?: string;
    preview: string; // kept for API compatibility; thumbnails are drawn from strokes
    bookmarked: boolean;
  }[];
  activeId: string | null;
  dark: boolean;
  labels: {
    title: string;
    page: string;
    add: string;
    duplicate: string;
    delete: string;
    moveUp: string;
    moveDown: string;
    bookmark: string;
    removeBookmark: string;
    template: string;
    paper: string;
    templates: Record<PageTemplateId, string>;
    collapse: string;
    expand: string;
  };
  onSelect(id: string): void;
  onAdd(afterId: string | null, template: PageTemplateId): void;
  onDuplicate(id: string): void;
  onDelete(id: string): void;
  onMove(id: string, toIndex: number): void;
  onSetTemplate(id: string, template: PageTemplateId): void;
  onSetPaper(id: string, paper: string): void;
  onToggleBookmark(id: string): void;
}

type Labels = PageThumbnailsProps['labels'];

/* ------------------------------------------------------------------ */
/* Constants & styles                                                  */
/* ------------------------------------------------------------------ */

const THUMB_W = 120;
const THUMB_H = THUMB_W * PAGE_RATIO;
const LIST_GAP = 12; // must match the gap on the list
const PRELOAD_MARGIN = '400px 0px';
const EDGE_SCROLL_ZONE = 48;
const EDGE_SCROLL_MAX = 18;

const BTN = 'px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-white/10';
const SELECTED = 'bg-black text-white dark:bg-white dark:text-black';
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white';
const ICON_BTN = `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${FOCUS}`;
const MENU_ITEM = `flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10 ${FOCUS}`;

/* ------------------------------------------------------------------ */
/* Small hooks                                                         */
/* ------------------------------------------------------------------ */

/** Returns the previous labels object while the content is unchanged, so memo'd items stay memo'd. */
function useStableLabels(labels: Labels): Labels {
  const ref = useRef<{ obj: Labels; key: string }>({ obj: labels, key: JSON.stringify(labels) });
  const key = JSON.stringify(labels);
  if (ref.current.key !== key) ref.current = { obj: labels, key };
  return ref.current.obj;
}

/** Device pixel ratio, capped at 2, updated when it changes (zoom / moving between screens). */
function useDpr(): number {
  const [raw, setRaw] = useState<number>(() => window.devicePixelRatio || 1);
  useEffect(() => {
    const mq = window.matchMedia(`(resolution: ${raw}dppx)`);
    const onChange = (): void => setRaw(window.devicePixelRatio || 1);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [raw]);
  return Math.min(2, raw);
}

/* ------------------------------------------------------------------ */
/* Item                                                                */
/* ------------------------------------------------------------------ */

interface ItemActions {
  registerEl(id: string, el: HTMLElement | null): void;
  select(id: string): void;
  addAfter(id: string): void;
  duplicate(id: string): void;
  remove(id: string): void;
  setTemplate(id: string, template: PageTemplateId): void;
  setPaper(id: string, paper: string): void;
  toggleBookmark(id: string): void;
  move(id: string, toIndex: number): void;
  toggleMenu(id: string): void;
  closeMenu(): void;
  dragStart(id: string, e: ReactPointerEvent<HTMLButtonElement>): void;
  dragMove(e: ReactPointerEvent<HTMLButtonElement>): void;
  dragEnd(e: ReactPointerEvent<HTMLButtonElement>): void;
  dragCancel(e: ReactPointerEvent<HTMLButtonElement>): void;
}

interface ThumbProps {
  id: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  strokes: InkStroke[];
  template: PageTemplateId;
  paper: string | undefined;
  bookmarked: boolean;
  active: boolean;
  dark: boolean;
  dpr: number;
  root: HTMLElement | null;
  labels: Labels;
  menuOpen: boolean;
  dragging: boolean;
  actions: ItemActions;
}

function PageThumbInner(p: ThumbProps) {
  const {
    id, index, isFirst, isLast, strokes, template, paper, bookmarked, active,
    dark, dpr, root, labels, menuOpen, dragging, actions,
  } = p;

  const [seen, setSeen] = useState(false);
  const liRef = useRef<HTMLLIElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuDomId = useId();

  const setLiRef = useCallback(
    (el: HTMLLIElement | null): void => {
      liRef.current = el;
      actions.registerEl(id, el);
    },
    [actions, id],
  );

  // Become "seen" once the item is near the visible part of the scroll container; stay seen afterwards.
  useEffect(() => {
    if (seen || !root) return;
    const el = liRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { root, rootMargin: PRELOAD_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, root]);

  const showCanvas = strokes.length > 0 && seen;
  const cw = Math.round(THUMB_W * dpr);
  const ch = Math.round(THUMB_H * dpr);

  // Redraw only when strokes identity, theme or canvas size changes (or the canvas just mounted).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!showCanvas || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.width / PAGE_UNITS;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const inkDark = paperIsDark(paper, dark); // 'auto' ink turns light on a dark paper
    drawLayer(ctx, strokes, 'hl', inkDark);
    drawLayer(ctx, strokes, 'ink', inkDark);
  }, [showCanvas, strokes, dark, paper, cw, ch]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLLIElement>): void => {
    if (e.key === 'Escape' && menuOpen) {
      e.stopPropagation();
      actions.closeMenu();
      menuBtnRef.current?.focus();
    }
  };

  const onGripKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowUp' && !isFirst) {
      e.preventDefault();
      actions.move(id, index - 1);
    } else if (e.key === 'ArrowDown' && !isLast) {
      e.preventDefault();
      actions.move(id, index + 1);
    }
  };

  const starLabel = bookmarked ? labels.removeBookmark : labels.bookmark;

  return (
    <li
      ref={setLiRef}
      onKeyDown={onKeyDown}
      className={`flex flex-col items-center ${dragging ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        onClick={() => actions.select(id)}
        aria-label={`${labels.page} ${index + 1}`}
        aria-current={active ? 'page' : undefined}
        className={`relative block shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white dark:border-white/10 ${FOCUS} ${
          active ? 'ring-2 ring-black dark:ring-white' : ''
        }`}
        style={{ width: THUMB_W, height: THUMB_H }}
      >
        <PageBackground template={template} paper={paper} width={THUMB_W} height={THUMB_H} dark={dark} />
        {showCanvas && (
          <canvas
            ref={canvasRef}
            width={cw}
            height={ch}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}
      </button>

      <div className="mt-1 flex w-full items-center">
        <button
          type="button"
          aria-label={`${labels.moveUp} / ${labels.moveDown}`}
          title={`${labels.moveUp} / ${labels.moveDown}`}
          className={`${ICON_BTN} cursor-grab touch-none active:cursor-grabbing`}
          onPointerDown={(e) => actions.dragStart(id, e)}
          onPointerMove={actions.dragMove}
          onPointerUp={actions.dragEnd}
          onPointerCancel={actions.dragCancel}
          onLostPointerCapture={actions.dragCancel}
          onKeyDown={onGripKeyDown}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="min-w-0 flex-1 text-center text-xs tabular-nums text-gray-600 dark:text-gray-400">
          {index + 1}
        </span>

        <button
          type="button"
          aria-label={starLabel}
          title={starLabel}
          aria-pressed={bookmarked}
          className={ICON_BTN}
          onClick={() => actions.toggleBookmark(id)}
        >
          <Star className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>

        <button
          ref={menuBtnRef}
          type="button"
          aria-label={`${labels.page} ${index + 1} ⋯`}
          aria-expanded={menuOpen}
          aria-controls={menuDomId}
          data-menu-for={id}
          className={`${ICON_BTN} ${menuOpen ? SELECTED : ''}`}
          onClick={() => actions.toggleMenu(id)}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div
          id={menuDomId}
          data-menu-for={id}
          className="mt-1 flex w-full flex-col gap-0.5 rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-neutral-900"
        >
          <button type="button" className={MENU_ITEM} onClick={() => actions.addAfter(id)}>
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{labels.add}</span>
          </button>
          <button type="button" className={MENU_ITEM} onClick={() => actions.duplicate(id)}>
            <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{labels.duplicate}</span>
          </button>
          <button
            type="button"
            className={MENU_ITEM}
            disabled={isFirst}
            onClick={() => actions.move(id, index - 1)}
          >
            <ArrowUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{labels.moveUp}</span>
          </button>
          <button
            type="button"
            className={MENU_ITEM}
            disabled={isLast}
            onClick={() => actions.move(id, index + 1)}
          >
            <ArrowDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{labels.moveDown}</span>
          </button>

          <div role="group" aria-label={labels.template} className="px-1 pb-1 pt-1">
            <div className="px-1 pb-1 text-[11px] text-gray-500 dark:text-gray-400">{labels.template}</div>
            <div className="grid grid-cols-2 gap-1">
              {PAGE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={t.id === template}
                  onClick={() => actions.setTemplate(id, t.id)}
                  className={`${BTN} min-h-9 px-2 py-1 ${FOCUS} ${t.id === template ? SELECTED : ''}`}
                >
                  {labels.templates[t.id]}
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-label={labels.paper} className="px-1 pb-1">
            <div className="px-1 pb-1 text-[11px] text-gray-500 dark:text-gray-400">{labels.paper}</div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {PAPER_COLORS.map((c, n) => {
                const on = (paper ?? 'white') === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`${labels.paper} ${n + 1}`}
                    aria-pressed={on}
                    onClick={() => actions.setPaper(id, c.id)}
                    className={`h-8 w-8 rounded-full border ${FOCUS} ${on ? 'ring-2 ring-black dark:ring-white ring-offset-1' : 'border-gray-300 dark:border-white/30'}`}
                    style={{ background: paperColor(c.id, dark) }}
                  />
                );
              })}
            </div>
          </div>

          <button type="button" className={MENU_ITEM} onClick={() => actions.remove(id)}>
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{labels.delete}</span>
          </button>
        </div>
      )}
    </li>
  );
}

const PageThumb = memo(PageThumbInner);

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

interface DragInfo {
  id: string;
  pointerId: number;
  fromIndex: number;
  slot: number;
  el: HTMLElement;
}

interface DragView {
  id: string;
  slot: number;
  lineTop: number;
}

export default function PageThumbnails(props: PageThumbnailsProps) {
  const { pages, activeId, dark } = props;
  const labels = useStableLabels(props.labels);
  const dpr = useDpr();

  const [collapsed, setCollapsed] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  // Latest props (callbacks may change identity every render) and order, read from stable handlers.
  const cbRef = useRef<PageThumbnailsProps>(props);
  const idsRef = useRef<string[]>([]);
  useLayoutEffect(() => {
    cbRef.current = props;
    idsRef.current = props.pages.map((pg) => pg.id);
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<DragInfo | null>(null);
  const lastYRef = useRef(0);
  const speedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const setRootEl = useCallback((el: HTMLDivElement | null): void => {
    rootRef.current = el;
    setRoot(el);
  }, []);

  const actions = useMemo<ItemActions>(() => {
    const updateSlot = (y: number): void => {
      const d = dragRef.current;
      const wrap = listRef.current;
      if (!d || !wrap) return;
      const rects: { top: number; height: number }[] = [];
      for (const pid of idsRef.current) {
        const el = elsRef.current.get(pid);
        if (el) {
          const r = el.getBoundingClientRect();
          rects.push({ top: r.top, height: r.height });
        }
      }
      const slot = dropIndexFromY(rects, y);
      d.slot = slot;
      const wTop = wrap.getBoundingClientRect().top;
      const target = rects[slot];
      const last = rects[rects.length - 1];
      let lineTop = 0;
      if (target) lineTop = target.top - LIST_GAP / 2 - wTop;
      else if (last) lineTop = last.top + last.height + LIST_GAP / 2 - wTop;
      setDrag((prev) =>
        prev && prev.id === d.id && prev.slot === slot && prev.lineTop === lineTop
          ? prev
          : { id: d.id, slot, lineTop },
      );
    };

    const stopLoop = (): void => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      speedRef.current = 0;
    };

    const loop = (): void => {
      if (!dragRef.current) {
        rafRef.current = null;
        return;
      }
      const sc = rootRef.current;
      if (sc && speedRef.current !== 0) {
        sc.scrollTop += speedRef.current;
        updateSlot(lastYRef.current);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const finish = (d: DragInfo, commit: boolean): void => {
      stopLoop();
      dragRef.current = null;
      setDrag(null);
      if (d.el.hasPointerCapture(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
      if (commit) {
        const to = moveTargetIndex(d.fromIndex, d.slot);
        if (to !== d.fromIndex) cbRef.current.onMove(d.id, to);
      }
    };

    return {
      registerEl(id, el) {
        if (el) elsRef.current.set(id, el);
        else elsRef.current.delete(id);
      },
      select: (id) => cbRef.current.onSelect(id),
      addAfter(id) {
        setMenuId(null);
        cbRef.current.onAdd(id, 'blank');
      },
      duplicate(id) {
        setMenuId(null);
        cbRef.current.onDuplicate(id);
      },
      remove(id) {
        setMenuId(null);
        cbRef.current.onDelete(id); // parent shows the confirm dialog
      },
      setTemplate(id, template) {
        setMenuId(null);
        cbRef.current.onSetTemplate(id, template);
      },
      setPaper(id, paper) {
        setMenuId(null);
        cbRef.current.onSetPaper(id, paper);
      },
      toggleBookmark: (id) => cbRef.current.onToggleBookmark(id),
      move(id, toIndex) {
        setMenuId(null);
        cbRef.current.onMove(id, toIndex);
      },
      toggleMenu: (id) => setMenuId((cur) => (cur === id ? null : id)),
      closeMenu: () => setMenuId(null),

      dragStart(id, e) {
        if (dragRef.current) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const fromIndex = idsRef.current.indexOf(id);
        if (fromIndex === -1) return;
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        dragRef.current = { id, pointerId: e.pointerId, fromIndex, slot: fromIndex, el };
        lastYRef.current = e.clientY;
        setMenuId(null);
        updateSlot(e.clientY);
        if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop);
      },
      dragMove(e) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        lastYRef.current = e.clientY;
        const sc = rootRef.current;
        let speed = 0;
        if (sc) {
          const r = sc.getBoundingClientRect();
          if (e.clientY < r.top + EDGE_SCROLL_ZONE) {
            speed = -Math.min(EDGE_SCROLL_MAX, Math.ceil((r.top + EDGE_SCROLL_ZONE - e.clientY) / 4));
          } else if (e.clientY > r.bottom - EDGE_SCROLL_ZONE) {
            speed = Math.min(EDGE_SCROLL_MAX, Math.ceil((e.clientY - (r.bottom - EDGE_SCROLL_ZONE)) / 4));
          }
        }
        speedRef.current = speed;
        updateSlot(e.clientY);
      },
      dragEnd(e) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        finish(d, true);
      },
      dragCancel(e) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        finish(d, false);
      },
    };
  }, []);

  // Escape cancels an in-progress drag.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const d = dragRef.current;
      if (!d) return;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      speedRef.current = 0;
      dragRef.current = null;
      setDrag(null);
      if (d.el.hasPointerCapture(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging]);

  // Stop the rAF loop on unmount.
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Tap/click outside the open menu closes it.
  useEffect(() => {
    if (menuId === null) return;
    const onDown = (e: PointerEvent): void => {
      const t = e.target;
      const owner = t instanceof Element ? t.closest('[data-menu-for]') : null;
      if (!owner || owner.getAttribute('data-menu-for') !== menuId) setMenuId(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuId]);

  if (collapsed) {
    return (
      <aside
        aria-label={labels.title}
        className="flex h-full w-11 shrink-0 flex-col items-center border-r border-gray-200 bg-white py-2 dark:border-white/10 dark:bg-black"
      >
        <button
          type="button"
          aria-label={labels.expand}
          title={labels.expand}
          aria-expanded={false}
          className={ICON_BTN}
          onClick={() => setCollapsed(false)}
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        </button>
      </aside>
    );
  }

  const lastId = pages.length > 0 ? pages[pages.length - 1]?.id ?? null : null;

  return (
    <aside
      aria-label={labels.title}
      className="flex h-full w-44 shrink-0 select-none flex-col border-r border-gray-200 bg-white text-black dark:border-white/10 dark:bg-black dark:text-white"
    >
      <div className="flex items-center justify-between border-b border-gray-200 py-1 pl-3 pr-1 dark:border-white/10">
        <h2 className="truncate text-sm font-medium">{labels.title}</h2>
        <button
          type="button"
          aria-label={labels.collapse}
          title={labels.collapse}
          aria-expanded={true}
          className={ICON_BTN}
          onClick={() => setCollapsed(true)}
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div ref={setRootEl} className="min-h-0 flex-1 overflow-y-auto p-2">
        <div ref={listRef} className="relative">
          <ol className="flex flex-col" style={{ gap: LIST_GAP }}>
            {pages.map((pg, i) => (
              <PageThumb
                key={pg.id}
                id={pg.id}
                index={i}
                isFirst={i === 0}
                isLast={i === pages.length - 1}
                strokes={pg.strokes}
                template={pg.template ?? 'blank'}
                paper={pg.paper}
                bookmarked={pg.bookmarked}
                active={pg.id === activeId}
                dark={dark}
                dpr={dpr}
                root={root}
                labels={labels}
                menuOpen={menuId === pg.id}
                dragging={drag?.id === pg.id}
                actions={actions}
              />
            ))}
          </ol>
          {drag && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 h-0.5 rounded bg-black dark:bg-white"
              style={{ top: drag.lineTop - 1 }}
            />
          )}
        </div>

        <button
          type="button"
          aria-label={labels.add}
          title={labels.add}
          className={`mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-xs hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10 ${FOCUS}`}
          onClick={() => props.onAdd(lastId, 'blank')}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{labels.add}</span>
        </button>
      </div>
    </aside>
  );
}
