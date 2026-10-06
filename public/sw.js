/* Learning-OS service worker — deliberately small.
 *  - /assets/*  (Vite's content-hashed JS/CSS/images): cache-first, safe forever.
 *  - page navigations: network-first, falling back to the last cached app shell
 *    (so the app still opens offline, but a new deploy is picked up immediately).
 *  - /api/* and everything cross-origin (Firebase, YouTube, Gemini proxy): never touched.
 * The dictionary uses its own cache ('learning-os-data-v1', see dictionaryStore.ts);
 * this file only manages caches prefixed "los-". */
const VERSION = 'v1';
const ASSETS = 'los-assets-' + VERSION;
const PAGES = 'los-pages-' + VERSION;
const MAX_ASSETS = 150;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([ASSETS, PAGES]);
      for (const k of await caches.keys()) {
        if (k.startsWith('los-') && !keep.has(k)) await caches.delete(k);
      }
      await self.clients.claim();
    })()
  );
});

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.status === 200) {
    cache.put(request, res.clone()).then(() => trim(cache, MAX_ASSETS)).catch(() => {});
  }
  return res;
}

async function networkFirstShell(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    // The SPA serves the same index.html for every route, so one entry is enough.
    if (res.status === 200) cache.put('/index.html', res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const shell = await cache.match('/index.html');
    if (shell) return shell;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === 'navigate') {
    event.respondWith(networkFirstShell(req));
  }
});
