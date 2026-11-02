// Handwriting that is cleared (or whose page is deleted) must also leave the cloud, even if the app was closed in between.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import './helpers.mjs';

const pg = (id, text, extra = {}) => ({ id, text, ...extra });
const stroke = (id) => ({ id, kind: 'ballpoint', color: 'auto', width: 3, sim: true, sm: 0.5, pts: [10, 10, 0.5, 40, 30, 0.5, 80, 40, 0.5] });

let serial = 0;
/** A fresh copy of the store (= a new app session: all its in-memory caches are empty) wired to a shared fake cloud. */
async function freshSession() {
  const dir = join(process.cwd(), 'node_modules', '.cache', 'los-test');
  mkdirSync(dir, { recursive: true });
  const fake = join(dir, `fakeCloudInk${process.pid}.mjs`);
  writeFileSync(fake, `
    const cloud = (globalThis.__cloud ??= new Map());
    export const pullFromCloud = async (k) => (cloud.has(k) ? structuredClone(cloud.get(k)) : null);
    export const pushToCloudChecked = async (k, v) => { cloud.set(k, structuredClone(v)); return true; };
    export const deleteFromCloud = async (k) => { cloud.delete(k); };
    export const subscribeCloud = () => () => {};
  `);
  const outfile = join(dir, `storeInk${process.pid}_${++serial}.mjs`);
  await build({
    entryPoints: [resolve('src/notebookStore.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', jsx: 'automatic',
    external: ['react', 'react-dom'],
    plugins: [{ name: 'fake-cloud', setup(b) { b.onResolve({ filter: /cloudSync$/ }, () => ({ path: fake })); } }],
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}_${serial}`);
}

test('pagesThatLostInk: cleared pages and deleted pages are found, pages that still have ink are not', async () => {
  const S = await freshSession();
  const before = new Map([['a', 1], ['b', 2], ['c', 1]]);
  const lost = S.pagesThatLostInk(before, [pg('a', '', { ink: [stroke('s1')] }), pg('b', '', { ink: [] })]); // a keeps ink, b cleared, c deleted
  assert.deepEqual(lost.map((l) => l.pageId).sort(), ['b', 'c']);
  assert.equal(lost.find((l) => l.pageId === 'b').parts, 2);
});

test('cleared handwriting leaves the cloud even when the app was restarted before the next push', async () => {
  localStorage.clear();
  globalThis.__cloud = new Map();
  // session 1: handwriting is written and synced
  const S1 = await freshSession();
  const meta = await S1.createNote(null, 'Draw');
  await S1.saveNoteContent(meta.id, 'Draw', [pg('p1', 'x', { ink: [stroke('s1')] }), pg('p2', 'y', { ink: [stroke('s2')] })]);
  await S1.retrySync();
  const k1 = `ink_${meta.id}_p1`;
  const k2 = `ink_${meta.id}_p2`;
  assert.ok(globalThis.__cloud.has(k1) && globalThis.__cloud.has(k2), 'both ink documents are in the cloud');

  // session 2 (app restarted: nothing in memory): the student clears page 1's handwriting and deletes page 2
  const S2 = await freshSession();
  await S2.saveNoteContent(meta.id, 'Draw', [pg('p1', 'x', { ink: [] })]);
  await S2.retrySync();
  assert.equal(globalThis.__cloud.has(k1), false, 'the cleared page no longer has an ink document in the cloud');
  assert.equal(globalThis.__cloud.has(k2), false, 'the deleted page no longer has an ink document in the cloud');
  assert.equal(globalThis.__cloud.get(`note_${meta.id}`).pages.length, 1);
});

test('handwriting that comes back before the push is NOT deleted from the cloud', async () => {
  localStorage.clear();
  globalThis.__cloud = new Map();
  const S1 = await freshSession();
  const meta = await S1.createNote(null, 'Undo');
  await S1.saveNoteContent(meta.id, 'Undo', [pg('p1', 'x', { ink: [stroke('s1')] })]);
  await S1.retrySync();
  const S2 = await freshSession();
  await S2.saveNoteContent(meta.id, 'Undo', [pg('p1', 'x', { ink: [] })]); // cleared ...
  await S2.saveNoteContent(meta.id, 'Undo', [pg('p1', 'x', { ink: [stroke('s1')] })]); // ... and undone
  await S2.retrySync();
  assert.ok(globalThis.__cloud.has(`ink_${meta.id}_p1`));
});
