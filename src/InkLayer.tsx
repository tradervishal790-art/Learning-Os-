import { useEffect, useRef, useState } from 'react';
import type { InkStroke } from './notebookStore';
import type { InkMode, InkPrefs } from './inkPrefs';
import {
  PAGE_UNITS, drawLayer, drawStroke, eraseArea, eraseStrokes, newStrokeId, pushPoint, strokeHit, type Layer,
} from './inkEngine';
import {
  IDENTITY, applyXform, boundsOf, pickStrokes, selectInPolygon, selectInRect, strokePoints, transformSelected,
  type Box, type Xform,
} from './inkEdit';
import { recognizeShape } from './inkShapes';
import { resolveColor } from './inkEngine';

// ============================================================
// InkLayer.tsx — the handwriting surface of ONE page.
//
// Three canvases stacked on the page:
//   1. highlights (UNDER the text)  - so a highlight never hides the words
//   2. pen ink    (over the text)
//   3. live       (the stroke being drawn / dragged right now; also takes the pointer)
// The live canvas only gets pixels while a gesture is in progress, which
// keeps memory low when a note has many pages.
//
// Input rules: the pen always writes. A finger scrolls the page (unless
// "finger draw" is on). A finger touching while a pen is near is ignored
// (palm rejection). The pen's eraser button erases.
// Select mode: lasso / rectangle to pick strokes, then drag the box to
// move, a corner to resize, the top knob to rotate.
// ============================================================

type XOp = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rot';

type Gesture =
  | { type: 'laser'; id: number; strokes: { pts: { x: number; y: number }[]; end: number | null }[]; down: boolean; raf: number }
  | { type: 'draw'; id: number; stroke: InkStroke; anchor: [number, number]; snapped: boolean; timer?: ReturnType<typeof setTimeout> }
  | { type: 'erase'; id: number; working: InkStroke[]; last: [number, number] }
  | { type: 'pan'; id: number; lastX: number; lastY: number; scroller: HTMLElement | null; suspended: boolean }
  | { type: 'lasso'; id: number; start: [number, number]; pts: [number, number][]; sx: number; sy: number; moved: boolean }
  | { type: 'xform'; id: number; op: XOp; start: [number, number]; pivot: [number, number]; box: Box; sel: InkStroke[]; xf: Xform };

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
const HOLD_MS = 550; // hold still this long to snap a shape

/** Where the selection box is drawn while it is being dragged. */
interface Preview { box: Box; rotDeg: number }

export default function InkLayer({
  strokes, width, height, mode, prefs, selectedIds, paperDark = false, onCommit, onActivate, onSelect,
}: {
  strokes: InkStroke[];
  width: number;
  height: number;
  mode: InkMode;
  prefs: InkPrefs;
  selectedIds: string[];
  /** The paper is dark (e.g. a charcoal page in light theme): 'auto' ink must be light. */
  paperDark?: boolean;
  onCommit: (next: InkStroke[]) => void;
  onActivate: () => void;
  onSelect: (ids: string[]) => void;
}) {
  const hlRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const lassoRef = useRef<SVGPolygonElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastPen = useRef(0);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const selRef = useRef(selectedIds);
  selRef.current = selectedIds;

  const [draft, setDraft] = useState<InkStroke[] | null>(null); // strokes while erasing / dragging
  const [preview, setPreview] = useState<Preview | null>(null);
  const [themeDark, setDark] = useState(isDarkNow);
  const dark = themeDark || paperDark;
  const shown = draft ?? strokes;
  const scale = width > 0 ? width / PAGE_UNITS : 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Stop a fading laser trail when the page goes away.
  useEffect(() => () => {
    const g = gesture.current;
    if (g && g.type === 'laser') cancelAnimationFrame(g.raf);
  }, []);

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

  // Leaving select mode (or the page) drops the selection box.
  useEffect(() => {
    if (mode !== 'select' && selRef.current.length > 0) onSelect([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ---------- helpers ----------

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
  const paintLive = (list: InkStroke[], complete = false) => {
    const c = liveRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    for (const s of list) drawStroke(ctx, s, dark, complete);
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

  /** Hold-still shape snapping: replace the stroke by its neat version while the pen is still down. */
  const armSnap = (g: Extract<Gesture, { type: 'draw' }>) => {
    clearTimeout(g.timer);
    if (!prefs.shapeSnap) return;
    g.timer = setTimeout(() => {
      if (gesture.current !== g) return;
      const shape = recognizeShape(strokePoints(g.stroke));
      if (!shape) return;
      const flat: number[] = [];
      shape.pts.forEach(([x, y]) => flat.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, 0.5));
      g.stroke.pts = flat;
      g.stroke.sim = true;
      g.snapped = true;
      paintLive([g.stroke]);
    }, HOLD_MS);
  };

  const setLasso = (points: [number, number][]) => {
    lassoRef.current?.setAttribute('points', points.map(([x, y]) => `${x * scale},${y * scale}`).join(' '));
  };

  // ---------- laser pointer: marks stay fully visible while you draw and for a few seconds after you lift,
  // then fade away. Nothing is saved. ----------
  const LASER_FADE_MS = 900;
  const laserFrame = (g: Extract<Gesture, { type: 'laser' }>) => {
    const c = liveRef.current;
    if (!c) return;
    const ink = prefs.laserStyle === 'ink';
    const hold = Math.max(0.5, prefs.laserDelay) * 1000; // how long a finished mark stays before it fades
    const col = ink ? resolveColor(prefs.color, dark) : prefs.laserColor;
    const now = performance.now();
    g.strokes = g.strokes.filter((st) => st.end === null || now - st.end < hold + LASER_FADE_MS);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (g.strokes.length === 0 && !g.down) {
      liveOff();
      if (gesture.current === g) gesture.current = null;
      return;
    }
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const px = 1 / scale; // one screen pixel, in page units (the laser keeps its size at any zoom)
    for (const st of g.strokes) {
      const age = st.end === null ? 0 : now - st.end;
      const alpha = age <= hold ? 1 : Math.max(0, 1 - (age - hold) / LASER_FADE_MS);
      const pts = st.pts;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
        // smooth curve through the middle of each pair of points, so circles look round
        for (let i = 1; i < pts.length - 1; i++) {
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        }
        if (pts.length > 1) ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      };
      if (ink) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = col;
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, prefs.width * 1.2);
        path();
        ctx.stroke();
      } else {
        // a glowing beam: a soft coloured halo, then a solid core
        ctx.globalAlpha = alpha * 0.35;
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 16 * dpr;
        ctx.lineWidth = 9 * px;
        path();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3.6 * px;
        path();
        ctx.stroke();
      }
    }
    if (g.down && !ink) {
      const last = g.strokes[g.strokes.length - 1];
      const head = last?.pts[last.pts.length - 1];
      if (head) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = col;
        ctx.shadowBlur = 20 * dpr;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 8 * px, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    g.raf = requestAnimationFrame(() => laserFrame(g));
  };

  // ---------- pointer: drawing / erasing / lasso (on the live canvas) ----------

  const onDown = (e: React.PointerEvent) => {
    // a second finger lands while one finger is scrolling: that is a pinch-zoom, stop scrolling
    if (e.pointerType === 'touch' && gesture.current?.type === 'pan') {
      gesture.current.suspended = true;
      return;
    }
    {
      const prev = gesture.current;
      if (prev && prev.type === 'laser' && !prev.down && mode !== 'laser') {
        // an old laser mark is still showing: drop it so the new tool can start
        cancelAnimationFrame(prev.raf);
        gesture.current = null;
        liveOff();
      }
    }
    const cur = gesture.current;
    const fadingInk = !!cur && cur.type === 'laser' && !cur.down && mode === 'laser';
    if (mode === 'type' || (cur && !fadingInk)) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 5) return;
    if (e.pointerType === 'pen') lastPen.current = Date.now();

    if (mode === 'laser') {
      // a finger may point too (nothing is written, so no palm worry)
      liveRef.current!.setPointerCapture(e.pointerId);
      const [x, y] = toPage(e);
      const old = gesture.current;
      if (old && old.type === 'laser') {
        // marks from the last stroke are still showing: the new stroke joins them
        old.id = e.pointerId;
        old.down = true;
        old.strokes.push({ pts: [{ x, y }], end: null });
        return;
      }
      const g: Extract<Gesture, { type: 'laser' }> = { type: 'laser', id: e.pointerId, strokes: [{ pts: [{ x, y }], end: null }], down: true, raf: 0 };
      gesture.current = g;
      liveOn();
      laserFrame(g);
      return;
    }

    if (e.pointerType === 'touch') {
      if (!prefs.fingerDraw) {
        // a finger scrolls the page
        gesture.current = { type: 'pan', id: e.pointerId, lastX: e.clientX, lastY: e.clientY, scroller: findScroller(liveRef.current), suspended: false };
        liveRef.current!.setPointerCapture(e.pointerId);
        return;
      }
      // finger drawing is on: still ignore palms (pen nearby, or a big contact patch)
      if (Date.now() - lastPen.current < 800 || e.width > 40 || e.height > 40) return;
    }

    onActivate();
    liveRef.current!.setPointerCapture(e.pointerId);
    const [x, y] = toPage(e);

    if (mode === 'select') {
      gesture.current = { type: 'lasso', id: e.pointerId, start: [x, y], pts: [[x, y]], sx: e.clientX, sy: e.clientY, moved: false };
      return;
    }

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
    const g: Extract<Gesture, { type: 'draw' }> = { type: 'draw', id: e.pointerId, stroke, anchor: [x, y], snapped: false };
    gesture.current = g;
    liveOn();
    paintLive([stroke]);
    armSnap(g);
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

    if (g.type === 'laser') {
      if (!g.down) return;
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
      const cur = g.strokes[g.strokes.length - 1];
      for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
        const [x, y] = toPage(ev);
        cur.pts.push({ x, y });
      }
      return;
    }

    if (g.type === 'pan') {
      const dx = g.lastX - e.clientX;
      const dy = g.lastY - e.clientY;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      if (g.suspended) return; // two fingers = pinch zoom, the zoom handler owns the scroll position
      if (g.scroller) g.scroller.scrollBy(dx, dy);
      else window.scrollBy(dx, dy);
      return;
    }
    if (g.type === 'xform') return; // handled by the overlay

    const native = e.nativeEvent;
    const events = native.getCoalescedEvents?.() ?? [];
    const list = events.length > 0 ? events : [native];

    if (g.type === 'lasso') {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 6) g.moved = true;
      const [x, y] = toPage(e);
      if (prefs.selectShape === 'rect') {
        const [sx, sy] = g.start;
        setLasso([[sx, sy], [x, sy], [x, y], [sx, y]]);
      } else {
        g.pts.push([x, y]);
        setLasso(g.pts);
      }
      return;
    }

    if (g.type === 'erase') {
      for (const ev of list) {
        const [x, y] = toPage(ev);
        applyErase(g, x, y);
        placeRing(x, y, true);
      }
      return;
    }

    if (g.snapped) return; // the neat shape is showing; just wait for the pen to lift
    let added = false;
    for (const ev of list) {
      const [x, y] = toPage(ev);
      if (pushPoint(g.stroke.pts, x, y, g.stroke.sim ? 0.5 : ev.pressure)) added = true;
      if (Math.hypot(x - g.anchor[0], y - g.anchor[1]) * scale > 5) {
        g.anchor = [x, y];
        armSnap(g); // moved: restart the hold timer
      }
    }
    if (added) paintLive([g.stroke]);
  };

  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.type === 'xform') return; // overlay finishes it
    if (g.type === 'laser') {
      g.down = false; // the mark stays for a few seconds, then fades by itself and the live canvas is released
      g.strokes[g.strokes.length - 1].end = performance.now();
      return;
    }
    gesture.current = null;
    if (g.type === 'pan') return;
    if (g.type === 'erase') {
      placeRing(0, 0, false);
      setDraft(null);
      if (!cancelled && g.working !== strokesRef.current) onCommit(g.working);
      return;
    }
    if (g.type === 'lasso') {
      setLasso([]);
      if (cancelled) return;
      const [x, y] = toPage(e);
      if (!g.moved) {
        // a tap: pick the topmost stroke under the finger / pen, or clear the selection
        const all = strokesRef.current;
        for (let i = all.length - 1; i >= 0; i--) {
          if (strokeHit(all[i], x, y, 8)) return onSelect([all[i].id]);
        }
        return onSelect([]);
      }
      onSelect(
        prefs.selectShape === 'rect' ? selectInRect(strokesRef.current, g.start, [x, y]) : selectInPolygon(strokesRef.current, g.pts)
      );
      return;
    }
    clearTimeout(g.timer);
    liveOff();
    if (!cancelled && g.stroke.pts.length >= 3) onCommit([...strokesRef.current, g.stroke]);
  };

  // ---------- pointer: moving / resizing / rotating the selection (on the overlay) ----------

  const selectedStrokes = mode === 'select' ? pickStrokes(strokes, new Set(selectedIds)) : [];
  const box = boundsOf(selectedStrokes);

  const xfFor = (g: Extract<Gesture, { type: 'xform' }>, x: number, y: number): Xform => {
    const [px, py] = g.pivot;
    if (g.op === 'move') return { ...IDENTITY, px, py, dx: x - g.start[0], dy: y - g.start[1] };
    if (g.op === 'rot') {
      const rot = Math.atan2(y - py, x - px) - Math.atan2(g.start[1] - py, g.start[0] - px);
      return { ...IDENTITY, px, py, rot };
    }
    const s = Math.hypot(x - px, y - py) / (Math.hypot(g.start[0] - px, g.start[1] - py) || 1);
    return { ...IDENTITY, px, py, s: Math.min(12, Math.max(0.1, s)) };
  };

  const previewFor = (g: Extract<Gesture, { type: 'xform' }>): Preview => {
    const { box: b, xf } = g;
    const [px, py] = g.pivot;
    const grow = (v: number, p: number) => p + (v - p) * xf.s;
    return {
      box: { x0: grow(b.x0, px) + xf.dx, x1: grow(b.x1, px) + xf.dx, y0: grow(b.y0, py) + xf.dy, y1: grow(b.y1, py) + xf.dy },
      rotDeg: (xf.rot * 180) / Math.PI,
    };
  };

  const onHandleDown = (e: React.PointerEvent) => {
    const op = (e.target as HTMLElement).dataset.sel as XOp | undefined;
    if (!op || gesture.current || !box) return;
    if (e.pointerType === 'pen') lastPen.current = Date.now();
    if (e.pointerType === 'touch' && Date.now() - lastPen.current < 800) return; // palm
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const [x, y] = toPage(e);
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const pivot: [number, number] =
      op === 'rot' || op === 'move' ? [cx, cy]
      : op === 'nw' ? [box.x1, box.y1]
      : op === 'ne' ? [box.x0, box.y1]
      : op === 'se' ? [box.x0, box.y0]
      : [box.x1, box.y0];
    const ids = new Set(selectedIds);
    const g: Extract<Gesture, { type: 'xform' }> = {
      type: 'xform', id: e.pointerId, op, start: [x, y], pivot, box, sel: selectedStrokes, xf: { ...IDENTITY, px: pivot[0], py: pivot[1] },
    };
    gesture.current = g;
    setDraft(strokes.filter((s) => !ids.has(s.id))); // the static canvases keep the rest; the picked strokes ride on the live canvas
    liveOn();
    paintLive(selectedStrokes, true);
    setPreview(previewFor(g));
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.type !== 'xform' || g.id !== e.pointerId) return;
    const [x, y] = toPage(e);
    g.xf = xfFor(g, x, y);
    paintLive(g.sel.map((s) => applyXform(s, g.xf)), true);
    setPreview(previewFor(g));
  };

  const onHandleUp = (e: React.PointerEvent, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.type !== 'xform' || g.id !== e.pointerId) return;
    gesture.current = null;
    liveOff();
    setDraft(null);
    setPreview(null);
    const changed = g.xf.dx !== 0 || g.xf.dy !== 0 || g.xf.s !== 1 || g.xf.rot !== 0;
    if (!cancelled && changed) onCommit(transformSelected(strokesRef.current, new Set(selectedIds), g.xf));
  };

  const active = mode !== 'type';
  const shownBox = preview?.box ?? box;
  const knob = 'absolute w-5 h-5 rounded-full bg-white border-2 border-blue-500 pointer-events-auto';
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
      {mode === 'select' && (
        <svg aria-hidden className="absolute inset-0 z-40 pointer-events-none" width={width} height={height}>
          <polygon ref={lassoRef} points="" fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="6 4" />
        </svg>
      )}
      {mode === 'select' && shownBox && (
        <div
          className="absolute z-40 pointer-events-none"
          style={{
            left: shownBox.x0 * scale,
            top: shownBox.y0 * scale,
            width: (shownBox.x1 - shownBox.x0) * scale,
            height: (shownBox.y1 - shownBox.y0) * scale,
            transform: preview ? `rotate(${preview.rotDeg}deg)` : undefined,
          }}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={(e) => onHandleUp(e, false)}
          onPointerCancel={(e) => onHandleUp(e, true)}
        >
          <div data-sel="move" className="absolute inset-0 border border-dashed border-blue-500 bg-blue-500/5 pointer-events-auto cursor-move" style={{ touchAction: 'none' }} />
          <div data-sel="nw" className={`${knob} -left-2.5 -top-2.5 cursor-nwse-resize`} style={{ touchAction: 'none' }} />
          <div data-sel="ne" className={`${knob} -right-2.5 -top-2.5 cursor-nesw-resize`} style={{ touchAction: 'none' }} />
          <div data-sel="se" className={`${knob} -right-2.5 -bottom-2.5 cursor-nwse-resize`} style={{ touchAction: 'none' }} />
          <div data-sel="sw" className={`${knob} -left-2.5 -bottom-2.5 cursor-nesw-resize`} style={{ touchAction: 'none' }} />
          <div className="absolute left-1/2 -top-7 w-px h-7 bg-blue-500 pointer-events-none" />
          <div data-sel="rot" className={`${knob} left-1/2 -top-10 -ml-2.5 cursor-grab bg-blue-500`} style={{ touchAction: 'none' }} />
        </div>
      )}
      <div
        ref={ringRef}
        aria-hidden
        className="absolute left-0 top-0 z-40 rounded-full border border-gray-500 dark:border-white/70 pointer-events-none"
        style={{ display: 'none' }}
      />
    </>
  );
}
