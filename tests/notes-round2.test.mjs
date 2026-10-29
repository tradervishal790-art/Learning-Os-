import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTs } from './helpers.mjs';

/** The editor needs ONE copy of ProseMirror: bundle our own code but leave every npm package external. */
async function loadEditorExtensions() {
  const outfile = join(process.cwd(), 'node_modules', '.cache', 'los-test', `ext_${process.pid}.mjs`);
  await build({ entryPoints: [resolve('src/editorExtensions.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', packages: 'external', loader: { '.css': 'empty' } });
  return import(pathToFileURL(outfile).href);
}

// ---------- typing style survives an empty line ----------
async function makeEditor() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  for (const k of ['navigator', 'HTMLElement', 'Element', 'MutationObserver', 'getComputedStyle', 'Range', 'Selection', 'requestAnimationFrame', 'cancelAnimationFrame', 'DocumentFragment', 'Text', 'Event', 'KeyboardEvent', 'MouseEvent']) {
    try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
  }
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const { Editor } = await import('@tiptap/core');
  const ext = await loadEditorExtensions();
  const make = (html = '<p></p>', onUpdate = () => {}) =>
    new Editor({ element: dom.window.document.getElementById('root'), extensions: ext.buildExtensions('x'), content: html, onUpdate });
  const styled = () => {
    const e = make();
    e.chain().focus().setFontFamily('Georgia').setFontSize('24px').insertContent('hello').run();
    return e;
  };
  return { make, styled };
}
const style = (e) => { const a = e.getAttributes('textStyle'); return [a.fontFamily, a.fontSize]; };

test('font and size are kept after the written words are deleted', async () => {
  const { styled } = await makeEditor();
  // 1. select the words and delete them
  let e = styled();
  e.commands.setTextSelection({ from: 1, to: 6 });
  e.view.dispatch(e.state.tr.deleteSelection());
  e.commands.insertContent('x');
  assert.deepEqual(style(e), ['Georgia', '24px']);
  e.destroy();
  // 2. Ctrl+A, delete
  e = styled();
  e.commands.selectAll();
  e.view.dispatch(e.state.tr.deleteSelection());
  e.commands.insertContent('x');
  assert.deepEqual(style(e), ['Georgia', '24px']);
  e.destroy();
  // 3. Backspace one letter at a time until the line is empty
  e = styled();
  for (let i = 0; i < 5; i++) { const p = e.state.selection.from; e.view.dispatch(e.state.tr.delete(p - 1, p)); }
  assert.equal(e.state.doc.textContent, '');
  e.commands.insertContent('x');
  assert.deepEqual(style(e), ['Georgia', '24px']);
  e.destroy();
});

test('choosing "no font" on an empty line is respected (memory never overrides an explicit choice)', async () => {
  const { styled } = await makeEditor();
  const e = styled();
  e.commands.selectAll();
  e.view.dispatch(e.state.tr.deleteSelection());
  e.chain().focus().unsetFontFamily().unsetFontSize().run();
  e.commands.insertContent('x');
  assert.ok(!e.getAttributes('textStyle').fontFamily && !e.getAttributes('textStyle').fontSize);
  e.destroy();
});

test('links never leak into new typing after a linked word is deleted', async () => {
  const { make } = await makeEditor();
  const e = make('<p><a href="https://x.test">link</a></p>');
  e.commands.selectAll();
  e.view.dispatch(e.state.tr.deleteSelection());
  e.commands.insertContent('y');
  assert.equal(e.isActive('link'), false);
  e.destroy();
});

// ---------- switching tools is not an edit ----------
test('setEditable(…, false) switches editing without announcing an update', async () => {
  const { make } = await makeEditor();
  let updates = 0;
  const e = make('<p>a</p>', () => { updates += 1; });
  e.setEditable(false, false);
  e.setEditable(true, false);
  assert.equal(updates, 0);
  e.commands.insertContent('b');
  assert.equal(updates, 1);
  e.destroy();
  const src = readFileSync('src/PageEditor.tsx', 'utf8');
  assert.match(src, /setEditable\(mode === 'type' && !recall, false\)/);
});

// ---------- sync: handwriting edits that keep the stroke id ----------
test('a moved / recoloured stroke counts as a change in the sync merge', async () => {
  const { mergePages } = await loadTs('src/conflict.ts');
  const stroke = (pts, color = '#000000') => ({ id: 's1', kind: 'ballpoint', color, width: 2, pts, sim: false, sm: 0.5 });
  const page = (over) => ({ id: 'p1', text: 'a', html: '<p>a</p>', ink: [stroke([0, 0, 0.5, 10, 10, 0.5])], ...over });
  const snap = (pages) => ({ id: 'n', title: 't', pages, updatedAt: '2026-10-28T00:00:00Z' });
  const base = snap([page()]);
  const local = snap([page({ ink: [stroke([50, 50, 0.5, 60, 60, 0.5])] })]); // moved the drawing here
  const remote = snap([page({ text: 'ab', html: '<p>ab</p>' })]); // typed more there
  const out = mergePages(local, remote, base);
  assert.deepEqual(out.conflictingPageIds, ['p1']); // before: the move was invisible and the other copy silently won
  const recolour = mergePages(snap([page({ ink: [stroke([0, 0, 0.5, 10, 10, 0.5], '#ff0000')] })]), remote, base);
  assert.deepEqual(recolour.conflictingPageIds, ['p1']);
  // an untouched drawing is still not a conflict
  assert.deepEqual(mergePages(snap([page()]), remote, base).conflictingPageIds, []);
});

// ---------- small behaviours ----------
test('Reset pen only touches the pen, not the eraser, highlighter, laser or saved colours', () => {
  const src = readFileSync('src/inkPrefs.ts', 'utf8');
  const body = src.slice(src.indexOf('const reset = useCallback'), src.indexOf('return [prefs, setPrefs, reset]'));
  for (const kept of ['hlColor', 'eraserSize', 'laserColor', 'favorites', 'recentColors']) assert.ok(!body.includes(kept), kept + ' must not be reset');
  for (const reset of ['kind', 'color', 'width', 'smoothing', 'shapeSnap']) assert.ok(body.includes(reset), reset + ' should be reset');
});
