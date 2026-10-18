// Test helpers: jsdom globals + fake IndexedDB, and a loader that bundles a TypeScript file with esbuild.
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://learning-os.test/' });
for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'Node']) {
  try {
    globalThis[k] = k === 'window' ? dom.window : dom.window[k];
  } catch {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true });
  }
}
// Bundles go inside node_modules so that react / react-dom resolve to the same copy the tests use.
const out = join(process.cwd(), 'node_modules', '.cache', 'los-test');
mkdirSync(out, { recursive: true });
let n = 0;

/** Bundle `src/...ts` (relative to the repo root) and import it. */
export async function loadTs(rel) {
  const outfile = join(out, `m${process.pid}_${n++}.mjs`);
  await build({ entryPoints: [resolve(rel)], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', jsx: 'automatic', banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }, external: ['@vercel/node', 'react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'] });
  return import(pathToFileURL(outfile).href);
}
