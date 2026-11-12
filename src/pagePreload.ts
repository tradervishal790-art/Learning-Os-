// Warm the lazy screen chunks so tapping a tab swaps the page instantly instead of flashing a loader.
// (The service worker already downloads the files; this only runs/parses them ahead of the tap.)

type Loader = () => Promise<unknown>;

const LOADERS: Record<string, Loader[]> = {
  roadmap: [() => import('./Roadmap')],
  revision: [() => import('./Revision')],
  videos: [() => import('./VideoIntel')],
  mentor: [() => import('./Mentor')],
  notes: [() => import('./NotesHome'), () => import('./NoteLibrary')],
  progress: [() => import('./progress')],
  research: [() => import('./Research')],
  dictionary: [() => import('./Dictionary')],
  'current-affairs': [() => import('./CurrentAffairs')],
  test: [() => import('./Test')],
};

const started = new Set<string>();

/** Start loading one screen (safe to call many times, e.g. on finger-down of a tab). */
export function preloadPage(id: string): void {
  const loaders = LOADERS[id];
  if (!loaders || started.has(id)) return;
  started.add(id);
  loaders.forEach((load) => load().catch(() => started.delete(id)));
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };

/** After the app has settled, warm every screen one at a time so it never competes with what the user is doing. */
export function preloadAllPagesWhenIdle(): () => void {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return () => {}; // data saver on: only load what is tapped
  const queue = Object.keys(LOADERS);
  let timer = 0;
  let cancelled = false;
  const next = () => {
    if (cancelled) return;
    const id = queue.shift();
    if (!id) return;
    preloadPage(id);
    schedule(1200);
  };
  const schedule = (delay: number) => {
    timer = window.setTimeout(() => {
      const w = window as IdleWindow;
      if (w.requestIdleCallback) w.requestIdleCallback(next, { timeout: 4000 });
      else next();
    }, delay);
  };
  schedule(2500);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
