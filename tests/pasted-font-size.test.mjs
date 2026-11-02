// Sizes pasted from Word / web pages (pt, em, rem, %) must show the true number in the toolbar and zoom with the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** One copy of ProseMirror: bundle our code, keep every npm package external. */
async function loadEditorExtensions() {
  const outfile = join(process.cwd(), 'node_modules', '.cache', 'los-test', `fsz_${process.pid}.mjs`);
  await build({ entryPoints: [resolve('src/editorExtensions.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', packages: 'external', loader: { '.css': 'empty' } });
  return import(pathToFileURL(outfile).href);
}

test('pasted pt / em / % sizes are read into the editor form; the toolbar number is the real size', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  for (const k of ['navigator', 'HTMLElement', 'Element', 'MutationObserver', 'getComputedStyle', 'Range', 'Selection', 'requestAnimationFrame', 'cancelAnimationFrame', 'DocumentFragment', 'Text', 'Event', 'KeyboardEvent', 'MouseEvent', 'Node', 'DOMParser']) {
    try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
  }
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const { Editor } = await import('@tiptap/core');
  const ext = await loadEditorExtensions();
  const ed = new Editor({
    element: dom.window.document.getElementById('root'),
    extensions: ext.buildExtensions('x'),
    content: '<p><span style="font-size: 12pt">word</span> <span style="font-size: 2em">big</span> <span style="font-size: 20px">px</span></p>',
  });
  const sizeAt = (pos) => {
    ed.commands.setTextSelection(pos);
    return ext.cssToSize(ed.getAttributes('textStyle').fontSize);
  };
  assert.equal(sizeAt(3), 16, '12pt = 16px');
  assert.equal(sizeAt(8), 32, '2em = 32px');
  assert.equal(sizeAt(13), 20);
  // stored and exported in the zoom-proof form, never as raw pt / em
  const html = ed.getHTML();
  assert.ok(!/font-size:\s*(12pt|2em)/.test(html), html);
  assert.ok(html.includes('calc(16 * var(--note-px, 1px))') && html.includes('calc(32 * var(--note-px, 1px))'), html);
  // the toolbar's own commands still work
  ed.chain().selectAll().setFontSize(ext.sizeToCss(24)).run();
  assert.ok(ed.getHTML().includes('calc(24 * var(--note-px, 1px))'));
  ed.destroy();
});
