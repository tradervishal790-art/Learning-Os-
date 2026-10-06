// ============================================================
// cacheWarmup.tsx
//
// First-visit caching, the way Netflix/YouTube/Amazon do it, scaled to us:
//   1. Service worker (public/sw.js) — app shell + hashed JS/CSS/images are
//      kept on the device, so repeat visits open instantly (and offline).
//   2. Dictionary (~20MB) — downloaded ONCE in the background while the
//      user is idle, saved in the Cache API, then read from the device.
// Rendered once, inside AuthGate (signed-in users only).
// ============================================================

import { useEffect } from 'react';
import { warmDictionaryCache } from './dictionaryStore';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** Don't burn a student's mobile data on a 20MB background download:
 *  skip when Data Saver is on or the connection is slow. (If skipped, the
 *  dictionary still downloads — and gets cached — on first real use.) */
function canPrefetchHeavy(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && c.effectiveType !== '4g') return false;
  return true;
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Non-critical: app works exactly as before without it.
  });
}

export default function CacheWarmup() {
  useEffect(() => {
    registerServiceWorker();

    const run = () => {
      if (canPrefetchHeavy()) void warmDictionaryCache().catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 15000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 5000);
    return () => clearTimeout(t);
  }, []);

  return null;
}
