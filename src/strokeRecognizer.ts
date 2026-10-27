// src/strokeRecognizer.ts
// FAST handwriting -> text that works on the STROKE POINTS (x, y), not on a picture.
// No upload of images, no LLM. Order tried by recognizeInk() (see inkOcrApi.ts):
//   1. Browser Handwriting Recognition API (offline, instant) - only where the browser has it
//   2. Google Input Tools handwriting endpoint (online, ~0.3-1 s) - unofficial, so it may stop working
//   3. (caller) Gemini picture reader as the last fallback
import type { InkStroke } from './notebookStore';
import { layerOf } from './inkEngine';

export type InkLang = 'en' | 'hi';

interface Box { x0: number; y0: number; x1: number; y1: number }

/** [x, y] pairs of a stroke (pts is flat [x, y, pressure, ...]). */
function xy(s: InkStroke): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < s.pts.length; i += 3) out.push([s.pts[i], s.pts[i + 1]]);
  return out;
}

function boxOf(s: InkStroke): Box {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of xy(s)) {
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.y0 = Math.min(b.y0, y);
    b.y1 = Math.max(b.y1, y);
  }
  return b;
}

/**
 * Split strokes into lines of writing (top to bottom), each line sorted left to right.
 * A stroke joins the current line when its vertical centre lies inside that line's band.
 * Exported so it can be unit-tested.
 */
export function groupIntoLines(strokes: InkStroke[]): InkStroke[][] {
  const items = strokes
    .filter((s) => layerOf(s) === 'ink' && s.pts.length >= 3)
    .map((s) => ({ s, b: boxOf(s) }))
    .filter((it) => Number.isFinite(it.b.x0));
  if (items.length === 0) return [];

  const heights = items.map((it) => it.b.y1 - it.b.y0).sort((a, b) => a - b);
  const medianH = Math.max(8, heights[Math.floor(heights.length / 2)]);

  items.sort((a, b) => (a.b.y0 + a.b.y1) / 2 - (b.b.y0 + b.b.y1) / 2);
  const lines: { items: typeof items; y0: number; y1: number }[] = [];
  for (const it of items) {
    const cy = (it.b.y0 + it.b.y1) / 2;
    const last = lines[lines.length - 1];
    const slack = medianH * 0.25;
    if (last && cy >= last.y0 - slack && cy <= last.y1 + slack) {
      last.items.push(it);
      // keep the band close to the typical letter height so one tall stroke does not swallow the next line
      last.y0 = Math.min(last.y0, it.b.y0);
      last.y1 = Math.max(last.y1, Math.min(it.b.y1, last.y0 + medianH * 2.2));
    } else {
      lines.push({ items: [it], y0: it.b.y0, y1: Math.min(it.b.y1, it.b.y0 + medianH * 2.2) });
    }
  }
  return lines.map((l) => l.items.sort((a, b) => a.b.x0 - b.b.x0).map((it) => it.s));
}

function lineBox(line: InkStroke[]): Box {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const s of line) {
    const sb = boxOf(s);
    b.x0 = Math.min(b.x0, sb.x0);
    b.x1 = Math.max(b.x1, sb.x1);
    b.y0 = Math.min(b.y0, sb.y0);
    b.y1 = Math.max(b.y1, sb.y1);
  }
  return b;
}

// ---------- 1. Browser Handwriting Recognition API ----------

interface BrowserRecognizer {
  startDrawing(hints?: Record<string, unknown>): {
    addStroke(stroke: unknown): void;
    getPrediction(): Promise<{ text: string }[]>;
    clear(): void;
  };
  finish(): void;
}
interface HandwritingNav {
  createHandwritingRecognizer?: (c: { languages: string[] }) => Promise<BrowserRecognizer>;
  queryHandwritingRecognizerSupport?: (q: { languages: string[] }) => Promise<{ languages?: boolean }>;
}

export async function recognizeWithBrowser(lines: InkStroke[][], lang: InkLang): Promise<string | null> {
  const nav = navigator as unknown as HandwritingNav;
  if (!nav.createHandwritingRecognizer || !nav.queryHandwritingRecognizerSupport) return null;
  try {
    const sup = await nav.queryHandwritingRecognizerSupport({ languages: [lang] });
    if (!sup.languages) return null;
    const Ctor = (globalThis as unknown as { HandwritingStroke?: new () => { addPoint(p: unknown): void } }).HandwritingStroke;
    if (!Ctor) return null;
    const rec = await nav.createHandwritingRecognizer({ languages: [lang] });
    const out: string[] = [];
    for (const line of lines) {
      const drawing = rec.startDrawing({ recognitionType: 'text' });
      let t = 0;
      for (const s of line) {
        const hs = new Ctor();
        xy(s).forEach(([x, y]) => hs.addPoint({ x, y, t: (t += 10) }));
        drawing.addStroke(hs);
      }
      const pred = await drawing.getPrediction();
      out.push(pred[0]?.text ?? '');
      drawing.clear();
    }
    rec.finish();
    const text = out.join('\n').trim();
    return text || null;
  } catch {
    return null;
  }
}

// ---------- 2. Google Input Tools (online, free, unofficial) ----------

const GOOGLE_URL = 'https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';

async function googleLine(line: InkStroke[], lang: InkLang, signal: AbortSignal): Promise<string> {
  const b = lineBox(line);
  let t = 0;
  const ink = line.map((s) => {
    const xs: number[] = [];
    const ys: number[] = [];
    const ts: number[] = [];
    for (const [x, y] of xy(s)) {
      xs.push(Math.round(x));
      ys.push(Math.round(y));
      ts.push((t += 10)); // our strokes carry no time; an even rhythm is good enough
    }
    t += 150; // small pause between strokes
    return [xs, ys, ts];
  });
  const res = await fetch(GOOGLE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      options: 'enable_pre_space',
      requests: [
        {
          writing_guide: { writing_area_width: Math.max(1, Math.round(b.x1 - b.x0)), writing_area_height: Math.max(1, Math.round(b.y1 - b.y0)) },
          ink,
          language: lang,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Shape: ["SUCCESS", [[ "id", ["best", "alt", ...], ... ]]]
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body[0] !== 'SUCCESS') throw new Error('not successful');
  const best = (body as unknown[][])[1]?.[0] as unknown[] | undefined;
  const cands = best?.[1];
  return Array.isArray(cands) && typeof cands[0] === 'string' ? cands[0] : '';
}

export async function recognizeWithGoogle(lines: InkStroke[][], lang: InkLang, timeoutMs = 6000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // all lines go out together, so many lines still cost about one round trip
    const parts = await Promise.all(lines.map((l) => googleLine(l, lang, ctrl.signal)));
    const text = parts.join('\n').trim();
    return text || null;
  } catch {
    return null; // blocked (CORS / offline / limit) -> caller falls back
  } finally {
    clearTimeout(timer);
  }
}

/** Fast path. Returns null when nothing usable came back (caller then uses the Gemini picture reader). */
export async function recognizeStrokes(strokes: InkStroke[], lang: InkLang = 'en'): Promise<string | null> {
  const lines = groupIntoLines(strokes);
  if (lines.length === 0) return null;
  return (await recognizeWithBrowser(lines, lang)) ?? (await recognizeWithGoogle(lines, lang));
}
