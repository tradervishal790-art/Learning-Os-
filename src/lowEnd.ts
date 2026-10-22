// Decides whether to skip purely decorative heavy visuals (the WebGL landing sphere).
// Skipped when the visitor asked for less motion, is on Data Saver, or is on a very
// weak device (<= 2 GB RAM or <= 2 CPU cores). Never affects functionality.

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

export function shouldSkipHeavyVisuals(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
    const nav = navigator as Navigator & NavigatorHints;
    if (nav.connection?.saveData) return true;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true;
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return true;
  } catch {
    // Unknown environment — default to showing the visuals.
  }
  return false;
}
