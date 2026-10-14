import { useEffect, useRef, useState } from 'react';
import type { InkStroke } from './notebookStore';
import type { InkMode, InkPrefs } from './inkPrefs';
import {
  PAGE_UNITS, drawLayer, drawStroke, eraseArea, eraseStrokes, newStrokeId, pushPoint, type Layer,
} from './inkEngine';

// ============================================================
// InkLayer.tsx — the handwriting surface of ONE page.
//
// Three canvases stacked on the page:
//   1. highlights (UNDER the text)  - so a highlight never hides the words
//   2. pen ink    (over the text)
//   3. live       (the stroke being drawn right now; also takes the pointer)
// The live canvas only gets pixels while a stroke is in progress, which
// keeps memory low when a note has many pages.
//
// Input rules: the pen always writes. A finger scrolls the page (unless
// "finger draw" is on). A finger touching while a pen is near is ignored
// (palm rejection). The pen's eraser button erases.
// ============================================================

type Gesture =
  | { type: 'draw'; id: number; stroke: InkStroke }
  | { type: 'erase'; id: number; working: InkStroke[]; last: [number, number] }
  | { type: 'pan'; id: number; lastY: number; scroller: HTMLElement | null };

function findScroller(el: HTMLElement | null): HTMLElement | null {
  let n = el?.parentElement ?? null;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    n = n.parentElement;
  }
  return null; // = the window
}

const isDarkNow = () => document.documentElement.classList.contains('dark');

export default function InkLayer({
  strokes, width, height, mode, prefs, onCommit, onActivate,
}: {
  strokes: InkStroke[];
  width: number;
  height: number;
  mode: InkMode;
  prefs: InkPrefs;
  onCommit: (next: InkStroke[]) => void;
  onActivate: () => void;
}) {
  const hlRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastPen = useRef(0);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const [draft, setDraft] = useState<InkStroke[] | null>(null); // strokes while erasing
  const [dark, setDark] = useState(isDarkNow);
  const shown = draft ?? strokes;
  const scale = width > 0 ? width / PAGE_UNITS : 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Re-draw when the app switches between light and dark ('auto' ink changes colour).
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(isDarkNow()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  // Committed strokes -> the two static canvases.
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    const paint = (canvas: HTMLCanvasElement | null, layer: Layer) => {
      if (!canvas) return;
      const has = shown.some((s) => (layer === 'hl' ? s.kind === 'highlighter' : s.kind !== 'highlighter'));
      const w = has ? Math.round(width * dpr) : 1;
      const h = has ? Math.round(height * dpr) : 1;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx || !has) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      drawLayer(ctx, shown, layer, dark);
    };
    paint(hlRef.current, 'hl');
    paint(inkRef.current, 'ink');
  }, [shown, width, height, dark, dpr, scale]);

  // ---------- pointer handling ----------

  const toPage = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = liveRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
  };

  const placeRing = (x: number, y: number, show: boolean) => {
    const ring = ringRef.current;
    if (!ring) return;
    if (!show) {
      ring.style.display = 'none';
      return;
    }
    const d = prefs.eraserSize * 2 * scale;
    ring.style.display = 'block';
    ring.style.width = ring.style.height = `${d}px`;
    ring.style.transform = `translate(${x * scale - d / 2}px, ${y * scale - d / 2}px)`;
  };

  const liveOn = () => {
    const c = liveRef.current!;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
  };
  const liveOff = () => {
    const c = liveRef.current!;
    c.width = 1;
    c.height = 1;
  };
  const paintLive = (s: InkStroke) => {
    const c = liveRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    drawStroke(ctx, s, dark, false);
  };

  const applyErase = (g: Extract<Gesture, { type: 'erase' }>, x: number, y: number) => {
    // walk from the previous eraser position so a fast swipe can't skip over strokes
    const [lx, ly] = g.last;
    const r = prefs.eraserSize;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / Math.max(2, r / 2)));
    let next = g.working;
    for (let i = 1; i <= steps; i++) {
      const px = lx + ((x - lx) * i) / steps;
      const py = ly + ((y - ly) * i) / steps;
      next = prefs.eraserMode === 'area'
        ? eraseArea(next, px, py, r, prefs.eraserTarget)
        : eraseStrokes(next, px, py, r, prefs.eraserTarget);
    }
    g.last = [x, y];
    if (next !== g.working) {
      g.working = next;
      setDraft(next);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (mode === 'type' || gesture.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 5) return;
    if (e.pointerType === 'pen') lastPen.current = Date.now();

    if (e.pointerType === 'touch') {
      if (!prefs.fingerDraw) {
        // a finger scrolls the page
        gesture.current = { type: 'pan', id: e.pointerId, lastY: e.clientY, scroller: findScroller(liveRef.current) };
        liveRef.current!.setPointerCapture(e.pointerId);
        return;
      }
      // finger drawing is on: still ignore palms (pen nearby, or a big contact patch)
      if (Date.now() - lastPen.current < 800 || e.width > 40 || e.height > 40) return;
    }

    onActivate();
    liveRef.current!.setPointerCapture(e.pointerId);
    const [x, y] = toPage(e);
    const stylusEraser = e.pointerType === 'pen' && ((e.buttons & 32) !== 0 || e.button === 5);
    const tool = stylusEraser ? 'eraser' : mode;

    if (tool === 'eraser') {
      const g: Gesture = { type: 'erase', id: e.pointerId, working: strokesRef.current, last: [x, y] };
      gesture.current = g;
      applyErase(g, x, y);
      placeRing(x, y, true);
      return;
    }

    const hl = tool === 'highlighter';
    const real = e.pointerType === 'pen';
    const stroke: InkStroke = {
      id: newStrokeId(),
      kind: hl ? 'highlighter' : prefs.kind,
      color: hl ? prefs.hlColor : prefs.color,
      width: hl ? prefs.hlWidth : prefs.width,
      pts: [],
      sim: !real,
      sm: prefs.smoothing,
    };
    pushPoint(stroke.pts, x, y, real ? e.pressure : 0.5, 0);
    gesture.current = { type: 'draw', id: e.pointerId, stroke };
    liveOn();
    paintLive(stroke);
  };

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') lastPen.current = Date.now(); // pen hovering = palm rejection window
    const g = gesture.current;
    if (!g) {
      if (mode === 'eraser' && e.pointerType !== 'touch') {
        const [x, y] = toPage(e);
        placeRing(x, y, true);
      }
      return;
    }
    if (g.id !== e.pointerId) return;

    if (g.type === 'pan') {
      const dy = g.lastY - e.clientY;
      g.lastY = e.clientY;
      if (g.scroller) g.scroller.scrollBy(0, dy);
      else window.scrollBy(0, dy);
      return;
    }

    const native = e.nativeEvent;
    const events = native.getCoalescedEvents?.() ?? [];
    const list = events.length > 0 ? events : [native];

    if (g.type === 'erase') {
      for (const ev of list) {
        const [x, y] = toPage(ev);
        applyErase(g, x, y);
        placeRing(x, y, true);
      }
      return;
    }

    let added = false;
    for (const ev of list) {
      const [x, y] = toPage(ev);
      if (pushPoint(g.stroke.pts, x, y, g.stroke.sim ? 0.5 : ev.pressure)) added = true;
    }
    if (added) paintLive(g.stroke);
  };

  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.type === 'pan') return;
    if (g.type === 'erase') {
      placeRing(0, 0, false);
      setDraft(null);
      if (!cancelled && g.working !== strokesRef.current) onCommit(g.working);
      return;
    }
    liveOff();
    if (!cancelled && g.stroke.pts.length >= 3) onCommit([...strokesRef.current, g.stroke]);
  };

  const active = mode !== 'type';
  return (
    <>
      <canvas ref={hlRef} aria-hidden className="absolute inset-0 z-0 pointer-events-none" style={{ width, height }} />
      <canvas ref={inkRef} aria-hidden className="absolute inset-0 z-20 pointer-events-none" style={{ width, height }} />
      <canvas
        ref={liveRef}
        aria-hidden
        className="absolute inset-0 z-30"
        style={{
          width,
          height,
          pointerEvents: active ? 'auto' : 'none',
          touchAction: active ? 'none' : 'auto',
          cursor: mode === 'eraser' ? 'none' : active ? 'crosshair' : 'auto',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onPointerLeave={() => !gesture.current && placeRing(0, 0, false)}
      />
      <div
        ref={ringRef}
        aria-hidden
        className="absolute left-0 top-0 z-40 rounded-full border border-gray-500 dark:border-white/70 pointer-events-none"
        style={{ display: 'none' }}
      />
    </>
  );
}
