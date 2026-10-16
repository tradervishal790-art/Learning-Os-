import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

const ZOOM_STEP = 0.25;
const STORAGE_KEY = 'learning_os_notebook_zoom';

type Point = { x: number; y: number };

type PendingAdjust = {
  ax: number; // anchor offset inside the container's visible box (px)
  ay: number;
  prev: number;
  next: number;
  resetLeft: boolean;
};

/** Clamp to [ZOOM_MIN, ZOOM_MAX] and round to 2 decimals. */
export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  return Math.round(clamped * 100) / 100;
}

/**
 * Scroll position that keeps the content point under `anchorOffset` fixed
 * when the zoom changes from `oldZoom` to `newZoom`.
 *   before = (scroll + anchorOffset) / oldZoom
 *   scroll' = before * newZoom - anchorOffset
 */
export function anchoredScroll(
  scroll: number,
  anchorOffset: number,
  oldZoom: number,
  newZoom: number,
): number {
  if (!(oldZoom > 0)) return scroll;
  const before = (scroll + anchorOffset) / oldZoom;
  return before * newZoom - anchorOffset;
}

function readStored(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < ZOOM_MIN || n > ZOOM_MAX) return null;
    return n;
  } catch {
    return null;
  }
}

function writeStored(z: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(z));
  } catch {
    /* storage unavailable or full: ignore */
  }
}

export function useZoom(
  containerRef: RefObject<HTMLElement | null>,
  opts?: { initial?: number; onChange?: (z: number) => void },
): {
  zoom: number;
  setZoom: (z: number, anchor?: { x: number; y: number }) => void;
  fitWidth: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
} {
  const [zoom, setZoomState] = useState<number>(() =>
    clampZoom(readStored() ?? opts?.initial ?? 1),
  );

  // Latest zoom, readable synchronously from event handlers.
  const zoomRef = useRef<number>(zoom);
  // Zoom value that is currently reflected in the DOM (set in the layout effect).
  const committedRef = useRef<number>(zoom);
  // Scroll corrections waiting for the parent to commit the new width.
  const pendingRef = useRef<PendingAdjust[]>([]);
  // Unrounded zoom used by the wheel handler so tiny trackpad deltas don't stall.
  const rawRef = useRef<number>(zoom);

  const onChangeRef = useRef(opts?.onChange);
  onChangeRef.current = opts?.onChange;

  const applyZoom = useCallback(
    (z: number, anchor: Point | undefined, resetLeft: boolean): void => {
      const next = clampZoom(z);
      const prev = zoomRef.current;
      const el = containerRef.current;

      if (next === prev) {
        if (resetLeft && el) el.scrollLeft = 0;
        return;
      }

      zoomRef.current = next;

      if (el) {
        if (next === committedRef.current) {
          // Back to what the DOM already shows: pending corrections cancel out.
          const hadReset = resetLeft || pendingRef.current.some((p) => p.resetLeft);
          pendingRef.current = [];
          if (hadReset) el.scrollLeft = 0;
        } else {
          const rect = el.getBoundingClientRect();
          const ax = anchor ? anchor.x - rect.left - el.clientLeft : el.clientWidth / 2;
          const ay = anchor ? anchor.y - rect.top - el.clientTop : el.clientHeight / 2;
          pendingRef.current.push({ ax, ay, prev, next, resetLeft });
        }
      }

      setZoomState(next);
      writeStored(next);
      onChangeRef.current?.(next);
    },
    [containerRef],
  );

  const setZoom = useCallback(
    (z: number, anchor?: Point): void => applyZoom(z, anchor, false),
    [applyZoom],
  );

  // After the parent has applied the new width (same commit), fix the scroll position.
  useLayoutEffect(() => {
    committedRef.current = zoom;
    const pending = pendingRef.current;
    if (pending.length === 0) return;
    pendingRef.current = [];
    const el = containerRef.current;
    if (!el) return;

    let left = el.scrollLeft;
    let top = el.scrollTop;
    for (const p of pending) {
      left = p.resetLeft ? 0 : anchoredScroll(left, p.ax, p.prev, p.next);
      top = anchoredScroll(top, p.ay, p.prev, p.next);
    }
    el.scrollLeft = left;
    el.scrollTop = top;
  }, [zoom, containerRef]);

  // Track the container element so listeners attach once it becomes available.
  const [el, setEl] = useState<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally every render: React bails out when the element is unchanged
  useEffect(() => {
    setEl(containerRef.current);
  });

  useEffect(() => {
    if (!el) return;

    const pointers = new Map<number, Point>();
    let pinch: { startDist: number; startZoom: number } | null = null;

    const twoPoints = (): [Point, Point] | null => {
      const pts = Array.from(pointers.values());
      const a = pts[0];
      const b = pts[1];
      if (pts.length !== 2 || !a || !b) return null;
      return [a, b];
    };

    const syncPinch = (): void => {
      const pts = twoPoints();
      if (!pts) {
        pinch = null;
        return;
      }
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinch = d >= 1 ? { startDist: d, startZoom: zoomRef.current } : null;
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      syncPinch(); // starts a pinch only when exactly two touches are down
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch' || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinch) return;
      const pts = twoPoints();
      if (!pts) return;
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(pinch.startZoom * (dist / pinch.startDist), {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
    };

    const onPointerEnd = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') return;
      if (pointers.delete(e.pointerId)) syncPinch();
    };

    // Stops the browser's own two-finger pan/zoom. Single-finger gestures are never touched.
    const onTouchMove = (e: TouchEvent): void => {
      if (e.touches.length >= 2 && e.cancelable) e.preventDefault();
    };

    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 100;

      // Mouse wheel notches are large (~100); trackpad pinch deltas are small.
      const sensitivity = Math.abs(dy) >= 40 ? 0.0015 : 0.01;

      const current = zoomRef.current;
      const base = Math.abs(rawRef.current - current) < 0.01 ? rawRef.current : current;
      const raw = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, base * Math.exp(-dy * sensitivity)));
      rawRef.current = raw;
      setZoom(raw, { x: e.clientX, y: e.clientY });
    };

    const reset = (): void => {
      pointers.clear();
      pinch = null;
    };

    // Capture phase so we still see events if a child (the pen canvas) stops propagation.
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointermove', onPointerMove, true);
    el.addEventListener('pointerup', onPointerEnd, true);
    el.addEventListener('pointercancel', onPointerEnd, true);
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('blur', reset);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove, true);
      el.removeEventListener('pointerup', onPointerEnd, true);
      el.removeEventListener('pointercancel', onPointerEnd, true);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('blur', reset);
      reset();
    };
  }, [el, setZoom]);

  const fitWidth = useCallback((): void => applyZoom(1, undefined, true), [applyZoom]);
  const zoomIn = useCallback((): void => setZoom(zoomRef.current + ZOOM_STEP), [setZoom]);
  const zoomOut = useCallback((): void => setZoom(zoomRef.current - ZOOM_STEP), [setZoom]);

  return { zoom, setZoom, fitWidth, zoomIn, zoomOut };
}
