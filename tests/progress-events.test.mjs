import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/progressEvents.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
const { notifyProgressDataChanged, PROGRESS_DATA_CHANGED } = await import(moduleUrl);

test('Progress data notification emits the shared invalidation event', () => {
  const dispatched = [];
  globalThis.window = { dispatchEvent: (event) => { dispatched.push(event); return true; } };
  notifyProgressDataChanged();
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, PROGRESS_DATA_CHANGED);
});

test('Progress data notification is safe during server rendering', () => {
  const previousWindow = globalThis.window;
  try {
    delete globalThis.window;
    assert.doesNotThrow(() => notifyProgressDataChanged());
  } finally {
    if (previousWindow !== undefined) globalThis.window = previousWindow;
  }
});
