import { useSyncExternalStore } from 'react';

/**
 * Global "dock" for the Videos player.
 *
 * The YouTube iframe lives in ONE element owned by <PlayerHost/> (mounted once, above every
 * page). While the learner is on the Videos page that element is laid over the page's player
 * slot; when they go anywhere else (or scroll the slot away) it shrinks into a floating
 * mini player. Because the iframe is never re-parented or re-created, playback never stops.
 */

export interface DockVideo {
  id: string;
  title: string;
  channel: string;
}

export interface DockControls {
  play(): void;
  pause(): void;
}

interface DockState {
  /** Set while a player is mounted (playing, paused or loading). */
  video: DockVideo | null;
  playing: boolean;
  /** Element the YouTube iframe is portaled into (owned by PlayerHost). */
  host: HTMLElement | null;
  /** Learner pressed ✕ on the mini player. Cleared when a new player mounts or the slot is visible again. */
  dismissed: boolean;
}

let state: DockState = { video: null, playing: false, host: null, dismissed: false };
let slot: HTMLElement | null = null; // read every frame by PlayerHost, not reactive
let controls: DockControls | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<DockState>) {
  const next = { ...state, ...patch };
  const changed = (Object.keys(patch) as (keyof DockState)[]).some((k) => next[k] !== state[k]);
  if (!changed) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useDock(): DockState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** True while a video should stay alive in the background (drives Dashboard's keep-alive). */
export function useDockAlive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.video !== null && !state.dismissed,
    () => false,
  );
}

export function setDockHost(el: HTMLElement | null) {
  set({ host: el });
}

export function setDockSlot(el: HTMLElement | null) {
  slot = el;
}

export function getDockSlot(): HTMLElement | null {
  return slot;
}

/** Called by the page's player when it mounts. Returns the cleanup. */
export function mountDockPlayer(video: DockVideo, c: DockControls): () => void {
  controls = c;
  set({ video, playing: false, dismissed: false });
  return () => {
    if (controls === c) {
      controls = null;
      set({ video: null, playing: false, dismissed: false });
    }
  };
}

export function setDockPlaying(playing: boolean) {
  set({ playing });
}

export function dockPlay() {
  try {
    controls?.play();
  } catch {
    /* player not ready */
  }
}

export function dockPause() {
  try {
    controls?.pause();
  } catch {
    /* player not ready */
  }
}

/** ✕ on the mini player: stop the video and let the page drop it. */
export function dockClose() {
  dockPause();
  set({ dismissed: true, playing: false });
}

export function dockUndismiss() {
  set({ dismissed: false });
}

export function resetDock() {
  controls = null;
  slot = null;
  set({ video: null, playing: false, dismissed: false });
}
