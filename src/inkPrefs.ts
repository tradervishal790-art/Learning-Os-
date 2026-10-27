import { useCallback, useSyncExternalStore } from 'react';
import type { InkKind } from './notebookStore';

// ============================================================
// inkPrefs.ts — the student's pen settings. Saved on this device only
// (localStorage) so the last-used pen, colour and size come back next time.
// ============================================================

/** 'circle' is the AI pen: draw a loop around something and the AI tools work on what is inside it (nothing is saved). */
export type InkMode = 'type' | 'pen' | 'highlighter' | 'eraser' | 'select' | 'laser' | 'circle';

export interface PenFavorite {
  kind: InkKind;
  color: string;
  width: number;
}

export interface InkPrefs {
  kind: InkKind;
  color: string;
  width: number;
  hlColor: string;
  hlWidth: number;
  eraserMode: 'stroke' | 'area';
  eraserTarget: 'all' | 'ink' | 'hl';
  eraserSize: number;
  /** Let a finger draw. Off by default so a resting palm / scrolling finger never leaves marks. */
  fingerDraw: boolean;
  /** Smoothing 0..1. */
  smoothing: number;
  selectShape: 'lasso' | 'rect';
  /** Hold the pen still at the end of a stroke and a rough line / circle / triangle / rectangle becomes neat. */
  shapeSnap: boolean;
  /** Laser pointer dot / trail colour. */
  laserColor: string;
  /** 'dot' = glowing pointer; 'ink' = your pen colour, vanishes after laserDelay seconds. */
  laserStyle: 'dot' | 'ink';
  laserDelay: number;
  favorites: PenFavorite[];
  recentColors: string[];
}

export const DEFAULT_PREFS: InkPrefs = {
  kind: 'ballpoint',
  color: 'auto',
  width: 2,
  hlColor: '#fde047',
  hlWidth: 3,
  eraserMode: 'stroke',
  eraserTarget: 'all',
  eraserSize: 14,
  fingerDraw: false,
  smoothing: 0.5,
  selectShape: 'lasso',
  shapeSnap: false,
  laserColor: '#ef4444',
  laserStyle: 'dot',
  laserDelay: 3,
  favorites: [],
  recentColors: [],
};

const KEY = 'learning_os_ink_prefs_v1';
let cache: InkPrefs | null = null;
const listeners = new Set<() => void>();

const INK_KINDS = new Set<InkKind>([
  'ballpoint', 'fountain', 'felt', 'pencil', 'brush', 'calligraphy',
  'fineliner', 'marker', 'dotted', 'highlighter', 'calligraphyBrush',
  'airbrush', 'oil', 'crayon', 'natural', 'watercolor',
]);

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Recover safely from stale, partial, or malformed settings saved by older app versions. */
export function normalizeInkPrefs(value: unknown): InkPrefs {
  const raw = value && typeof value === 'object' ? value as Partial<InkPrefs> : {};
  const favorites: PenFavorite[] = [];
  if (Array.isArray(raw.favorites)) {
    for (const item of raw.favorites) {
      if (!item || typeof item !== 'object') continue;
      const favorite = item as Partial<PenFavorite>;
      if (!INK_KINDS.has(favorite.kind as InkKind) || typeof favorite.color !== 'string' || !favorite.color.trim()) continue;
      const width = bounded(favorite.width, NaN, 0.5, 20);
      if (!Number.isFinite(width)) continue;
      if (favorites.some((f) => f.kind === favorite.kind && f.color === favorite.color && f.width === width)) continue;
      favorites.push({ kind: favorite.kind as InkKind, color: favorite.color, width });
      if (favorites.length === 5) break;
    }
  }
  const recentColors = Array.isArray(raw.recentColors)
    ? [...new Set(raw.recentColors.filter((c): c is string => typeof c === 'string' && c.trim() && c !== 'auto'))].slice(0, 24)
    : [];
  return {
    ...DEFAULT_PREFS,
    ...raw,
    kind: INK_KINDS.has(raw.kind as InkKind) ? raw.kind as InkKind : DEFAULT_PREFS.kind,
    color: typeof raw.color === 'string' ? raw.color : DEFAULT_PREFS.color,
    width: bounded(raw.width, DEFAULT_PREFS.width, 0.5, 20),
    hlColor: typeof raw.hlColor === 'string' ? raw.hlColor : DEFAULT_PREFS.hlColor,
    hlWidth: bounded(raw.hlWidth, DEFAULT_PREFS.hlWidth, 0.5, 30),
    eraserMode: raw.eraserMode === 'area' ? 'area' : 'stroke',
    eraserTarget: raw.eraserTarget === 'ink' || raw.eraserTarget === 'hl' ? raw.eraserTarget : 'all',
    eraserSize: bounded(raw.eraserSize, DEFAULT_PREFS.eraserSize, 6, 60),
    fingerDraw: typeof raw.fingerDraw === 'boolean' ? raw.fingerDraw : DEFAULT_PREFS.fingerDraw,
    smoothing: bounded(raw.smoothing, DEFAULT_PREFS.smoothing, 0, 1),
    selectShape: raw.selectShape === 'rect' ? 'rect' : 'lasso',
    shapeSnap: typeof raw.shapeSnap === 'boolean' ? raw.shapeSnap : DEFAULT_PREFS.shapeSnap,
    laserColor: typeof raw.laserColor === 'string' ? raw.laserColor : DEFAULT_PREFS.laserColor,
    laserStyle: raw.laserStyle === 'ink' ? 'ink' : 'dot',
    laserDelay: bounded(raw.laserDelay, DEFAULT_PREFS.laserDelay, 1, 10),
    favorites,
    recentColors,
  };
}

function load(): InkPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeInkPrefs(JSON.parse(raw));
  } catch {
    // fall back to defaults if storage is unavailable or invalid JSON
  }
  return DEFAULT_PREFS;
}

function getPrefs(): InkPrefs {
  if (!cache) cache = load();
  return cache;
}

function setPrefs(patch: Partial<InkPrefs>): void {
  cache = normalizeInkPrefs({ ...getPrefs(), ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // not critical
  }
  listeners.forEach((l) => l());
}

export function useInkPrefs(): [InkPrefs, (patch: Partial<InkPrefs>) => void, () => void] {
  const prefs = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPrefs,
    getPrefs
  );
  const reset = useCallback(() => setPrefs({ ...DEFAULT_PREFS, favorites: getPrefs().favorites }), []);
  return [prefs, setPrefs, reset];
}

/** Remember a colour as "recent" (most recent first, max 8, no duplicates). */
export function rememberColor(color: string): void {
  if (color === 'auto') return;
  const rest = getPrefs().recentColors.filter((c) => c !== color);
  setPrefs({ recentColors: [color, ...rest].slice(0, 8) });
}
