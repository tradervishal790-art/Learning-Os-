/* Learning-OS service worker — deliberately small.
 *  - /assets/*  (Vite's content-hashed JS/CSS/images): cache-first, safe forever.
 *  - page navigations: network-first, falling back to the last cached app shell
 *    (so the app still opens offline, but a new deploy is picked up immediately).
 *  - /api/* and everything cross-origin (Firebase, YouTube, Gemini proxy): never touched.
 * The dictionary uses its own cache ('learning-os-data-v1', see dictionaryStore.ts);
 * this file only manages caches prefixed "los-". */
const VERSION = 'v3';
const ASSETS = 'los-assets-' + VERSION;
const PAGES = 'los-pages-' + VERSION;
const MAX_ASSETS = 600;

// On install, download every built file once (list made at build time) so the
// whole app works offline. Best-effort: a failure here never breaks the app.
async function precacheAll() {
  try {
    const res = await fetch('/precache-manifest.json', { cache: 'no-store' });
    if (!res.ok) return;
    const files = await res.json();
    const cache = await caches.open(ASSETS);
    await Promise.all(
      files.map(async (f) => {
        try {
          const cached = await cache.match(f);
          if (cached && isValidAssetResponse(cached)) return;
          if (cached) await cache.delete(f);
          const r = await fetch(f);
          if (isValidAssetResponse(r)) await cache.put(f, r);
        } catch (e) {}
      })
    );
    // Also keep the app shell ready, so the very first offline open works.
    const shell = await fetch('/', { cache: 'no-store' });
    if (shell.status === 200) await (await caches.open(PAGES)).put('/index.html', shell);
  } catch (e) {}
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precacheAll());
});

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

function isValidAssetResponse(response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return false;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  // Vercel's SPA fallback can return index.html for a missing chunk. Never
  // persist that HTML document under a JavaScript/CSS/image asset URL.
  return !contentType.includes('text/html');
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit && isValidAssetResponse(hit)) return hit;
  if (hit) await cache.delete(request);
  const res = await fetch(request);
  if (isValidAssetResponse(res)) {
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
