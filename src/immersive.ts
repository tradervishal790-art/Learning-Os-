import { useSyncExternalStore } from 'react';

/**
 * "Immersive" = a full-attention flow (e.g. taking a timed test) where the
 * mobile bottom bar should get out of the way, like Instagram hides its bar
 * inside full-screen viewers. A screen turns it on while active and off on
 * exit; BottomNav + Dashboard subscribe.
 */
let immersive = false;
const listeners = new Set<() => void>();

export function setImmersive(value: boolean) {
  if (immersive === value) return;
  immersive = value;
  listeners.forEach((l) => l());
}

export function useImmersive(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => immersive,
    () => false,
  );
}
