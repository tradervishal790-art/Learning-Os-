// src/VideoNotesPane.tsx
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { ChevronDown, ChevronUp, Clock, GripHorizontal, PictureInPicture2, RotateCcw } from 'lucide-react';
import { useYouTubePlayer } from './useYouTubePlayer';
import type { PlayerError } from './useYouTubePlayer';

export interface VideoPlayerApi {
  getTime(): number;
  seekTo(sec: number): void;
  play(): void;
  pause(): void;
}

export interface VideoNotesPaneProps {
  videoId: string;
  startAt?: number;
  /** The notebook editor, rendered on the other side. */
  notes: ReactNode;
  playerRef?: MutableRefObject<VideoPlayerApi | null>;
  onTime?(seconds: number): void;
  /** "Add timestamp": gets the current time, read WITHOUT pausing the video. */
  onCapture?(seconds: number): void;
  labels: {
    addTimestamp: string;
    speed: string;
    collapse: string;
    expand: string;
    retry: string;
    resizeHandle: string;
    float: string;
    dock: string;
    opacity: string;
    moveWindow: string;
    errors: Record<PlayerError, string>;
  };
}

const SPLIT_KEY = 'learning_os_video_split';
const MIN_SPLIT = 25;
const MAX_SPLIT = 65;
const DEFAULT_SPLIT = 45;
const KEY_STEP = 3;
const RATES = [0.75, 1, 1.25, 1.5, 2] as const;
const OPACITY_KEY = 'learning_os_video_float_opacity';
const FLOAT_W = 340;

function loadOpacity(): number {
  try {
    const v = Number.parseFloat(window.localStorage.getItem(OPACITY_KEY) ?? '');
    return Number.isFinite(v) ? Math.min(1, Math.max(0.25, v)) : 0.85;
  } catch {
    return 0.85;
  }
}

function clampSplit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPLIT;
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value));
}

function loadSplit(): number {
  try {
    const raw = window.localStorage.getItem(SPLIT_KEY);
    if (raw === null) return DEFAULT_SPLIT;
    return clampSplit(Number.parseFloat(raw));
  } catch {
    return DEFAULT_SPLIT;
  }
}

function saveSplit(value: number): void {
  try {
    window.localStorage.setItem(SPLIT_KEY, String(Math.round(value * 10) / 10));
  } catch {
    /* private mode / quota — the split just isn't remembered */
  }
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white';
const BTN = `inline-flex min-h-[36px] min-w-[36px] items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-white/10 ${FOCUS}`;
const BTN_PRIMARY = `${BTN} bg-black text-white dark:bg-white dark:text-black`;
const BTN_PLAIN = `${BTN} bg-white text-black dark:bg-black dark:text-white`;

interface DragState {
  startX: number;
  startSplit: number;
  width: number;
}

export default function VideoNotesPane({
  videoId,
  startAt,
  notes,
  playerRef,
  onTime,
  onCapture,
  labels,
}: VideoNotesPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const splitRef = useRef<number>(DEFAULT_SPLIT);
  const regionId = useId();

  const [split, setSplit] = useState<number>(loadSplit);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [rate, setRate] = useState<number>(1);
  // Floating window: the video leaves the split and hovers over the notes (draggable, see-through).
  const [floating, setFloating] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({ x: Math.max(8, window.innerWidth - FLOAT_W - 16), y: 72 }));
  const [opacity, setOpacity] = useState<number>(loadOpacity);
  const moveRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    splitRef.current = split;
  }, [split]);

  const player = useYouTubePlayer(videoBoxRef, { videoId, startAt, onTime });
  const { getTime, seekTo, play, pause } = player;

  // Expose the player so the parent can seek when a chip is clicked.
  useEffect(() => {
    if (!playerRef) return undefined;
    const api: VideoPlayerApi = { getTime, seekTo, play, pause };
    playerRef.current = api;
    return () => {
      if (playerRef.current === api) playerRef.current = null;
    };
  }, [playerRef, getTime, seekTo, play, pause]);

  const applySplit = useCallback((next: number): void => {
    const clamped = clampSplit(next);
    splitRef.current = clamped;
    setSplit(clamped);
  }, []);

  /* ---- draggable divider (pointer events: mouse, touch and pen) ---- */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const root = rootRef.current;
    if (!root) return;
    const width = root.getBoundingClientRect().width;
    if (width <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startSplit: splitRef.current, width };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag) return;
    applySplit(drag.startSplit + ((event.clientX - drag.startX) / drag.width) * 100);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    saveSplit(splitRef.current);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* capture already released */
    }
  };

  const onSeparatorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    applySplit(splitRef.current + (event.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP));
    saveSplit(splitRef.current);
  };

  const onRateChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) return;
    setRate(next);
    player.setRate(next);
  };

  const onOpacity = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Math.min(1, Math.max(0.25, Number(event.target.value)));
    setOpacity(next);
    try {
      window.localStorage.setItem(OPACITY_KEY, String(next));
    } catch {
      /* not remembered */
    }
  };

  const onMoveDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveRef.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y };
  };
  const onMoveMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const m = moveRef.current;
    if (!m) return;
    const x = Math.min(window.innerWidth - 80, Math.max(-FLOAT_W + 80, event.clientX - m.dx));
    const y = Math.min(window.innerHeight - 60, Math.max(0, event.clientY - m.dy));
    setPos({ x, y });
  };
  const onMoveEnd = (): void => {
    moveRef.current = null;
  };

  const rootStyle = { '--vn-split': `${split}%` } as CSSProperties;

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      className={`flex h-full min-h-0 w-full flex-col min-[1024px]:flex-row ${
        dragging ? 'cursor-col-resize select-none' : ''
      }`}
    >
      {/* Video column (top on small screens, left on >= 1024px) */}
      <section
        style={floating ? { left: pos.x, top: pos.y, width: `min(${FLOAT_W}px, 90vw)`, opacity } : undefined}
        className={
          floating
            ? 'fixed z-40 flex flex-col gap-2 rounded-xl border border-gray-300 bg-gray-50 p-2 shadow-2xl dark:border-white/20 dark:bg-neutral-900'
            : 'flex min-w-0 shrink-0 grow-0 flex-col gap-2 bg-gray-50 p-2 dark:bg-white/5 min-[1024px]:basis-[var(--vn-split)] min-[1024px]:sticky min-[1024px]:top-2 min-[1024px]:self-start'
        }
      >
        {floating && (
          <div
            role="presentation"
            aria-label={labels.moveWindow}
            title={labels.moveWindow}
            onPointerDown={onMoveDown}
            onPointerMove={onMoveMove}
            onPointerUp={onMoveEnd}
            onPointerCancel={onMoveEnd}
            className="flex h-6 cursor-move touch-none items-center justify-center text-gray-400 dark:text-white/50"
          >
            <GripHorizontal size={18} aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-controls={regionId}
            className={`${BTN_PLAIN} ${floating ? 'hidden' : 'min-[1024px]:hidden'}`}
          >
            {collapsed ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
            <span>{collapsed ? labels.expand : labels.collapse}</span>
          </button>

          <button
            type="button"
            disabled={!player.ready}
            // Keep the editor focused (and the soft keyboard up) while the button is tapped.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCapture?.(player.getTime())}
            className={BTN_PRIMARY}
          >
            <Clock size={16} aria-hidden="true" />
            <span>{labels.addTimestamp}</span>
          </button>

          <label className="inline-flex items-center gap-2 text-xs text-black dark:text-white">
            <span>{labels.speed}</span>
            <select
              value={rate}
              onChange={onRateChange}
              disabled={!player.ready}
              className={`min-h-[36px] rounded-lg border border-gray-200 bg-white px-2 text-xs text-black disabled:opacity-40 dark:border-white/10 dark:bg-black dark:text-white dark:[color-scheme:dark] ${FOCUS}`}
            >
              {RATES.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setFloating((value) => !value)}
            aria-pressed={floating}
            className={floating ? BTN_PRIMARY : BTN_PLAIN}
          >
            <PictureInPicture2 size={16} aria-hidden="true" />
            <span>{floating ? labels.dock : labels.float}</span>
          </button>

          {floating && (
            <label className="inline-flex items-center gap-2 text-xs text-black dark:text-white">
              <span>{labels.opacity}</span>
              <input type="range" min={0.25} max={1} step={0.05} value={opacity} onChange={onOpacity} className="w-20" />
            </label>
          )}
        </div>

        {/*
          Collapsing keeps the player mounted (audio keeps playing, no re-buffering) and the same DOM tree is used
          at every width, so crossing 1024px never remounts the iframe.
        */}
        <div
          id={regionId}
          className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${
            collapsed && !floating ? 'invisible max-h-0 min-[1024px]:visible min-[1024px]:max-h-none' : ''
          } ${dragging ? 'pointer-events-none' : ''}`}
        >
          <div ref={videoBoxRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />

          {player.error !== null && (
            <div
              role="alert"
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white p-4 text-center text-sm text-black dark:bg-black dark:text-white"
            >
              <p>{labels.errors[player.error]}</p>
              <button type="button" onClick={player.retry} className={BTN_PRIMARY}>
                <RotateCcw size={16} aria-hidden="true" />
                <span>{labels.retry}</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Divider (>= 1024px only). 36px wide hit area, thin visible bar. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={labels.resizeHandle}
        aria-valuemin={MIN_SPLIT}
        aria-valuemax={MAX_SPLIT}
        aria-valuenow={Math.round(split)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onSeparatorKeyDown}
        className={`hidden w-9 shrink-0 cursor-col-resize touch-none items-center justify-center bg-gray-100 dark:bg-white/5 ${floating ? '' : 'min-[1024px]:flex'} ${FOCUS}`}
      >
        <span aria-hidden="true" className="h-12 w-1 rounded-full bg-gray-400 dark:bg-white/40" />
      </div>

      {/* Notes side: always rendered, always usable — even when the video is in an error state. */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{notes}</div>
    </div>
  );
}
