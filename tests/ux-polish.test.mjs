import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('global hover feedback composes with motion transforms and respects reduced motion', async () => {
  const css = await read('../src/index.css');
  assert.match(css, /transition-property:\s*translate, transform/);
  assert.match(css, /translate:\s*0 -1px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /transform:\s*translateY\(-2px\)/);
});

test('mobile More navigation remains viewport-bounded and exposes readable labels', async () => {
  const [css, nav] = await Promise.all([read('../src/index.css'), read('../src/BottomNav.tsx')]);
  assert.match(css, /\.mobile-more-menu\s*\{[^}]*max-height:\s*calc\(100dvh/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(nav, /mobile-more-menu/);
  assert.match(nav, /\{item\.label\}/);
  assert.match(nav, /aria-current=\{active \? 'page' : undefined\}/);
});

test('dashboard page changes use a short, low-displacement transition', async () => {
  const dashboard = await read('../src/Dashboard.tsx');
  assert.match(dashboard, /useReducedMotion/);
  assert.match(dashboard, /initial=\{prefersReducedMotion \? false : \{ opacity: 0 \}\}/);
  assert.match(dashboard, /duration: prefersReducedMotion \? 0 : 0\.16/);
});
