// Test helpers: jsdom globals + fake IndexedDB, and a loader that bundles a TypeScript file with esbuild.
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://learning-os.test/' });
for (const k of ['window', 'document', 'DOMParser', 'localStorage']) {
  try {
    globalThis[k] = k === 'window' ? dom.window : dom.window[k];
  } catch {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true });
  }
}
const out = mkdtempSync(join(tmpdir(), 'los-test-'));
let n = 0;

/** Bundle `src/...ts` (relative to the repo root) and import it. */
export async function loadTs(rel) {
  const outfile = join(out, `m${n++}.mjs`);
  await build({ entryPoints: [resolve(rel)], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', external: ['@vercel/node'] });
  return import(pathToFileURL(outfile).href);
}
