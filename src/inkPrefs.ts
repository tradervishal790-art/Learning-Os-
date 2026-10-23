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

function load(): InkPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    // fall back to defaults
  }
  return DEFAULT_PREFS;
}

function getPrefs(): InkPrefs {
  if (!cache) cache = load();
  return cache;
}

function setPrefs(patch: Partial<InkPrefs>): void {
  cache = { ...getPrefs(), ...patch };
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
