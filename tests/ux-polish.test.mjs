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
  assert.match(nav, /closeOnEscape/);
  assert.match(nav, /aria-controls="mobile-more-menu"/);
});

test('dashboard page changes use a short, low-displacement transition', async () => {
  const dashboard = await read('../src/Dashboard.tsx');
  assert.match(dashboard, /useReducedMotion/);
  assert.match(dashboard, /initial=\{prefersReducedMotion \? false : \{ opacity: 0 \}\}/);
  assert.match(dashboard, /duration: prefersReducedMotion \? 0 : 0\.16/);
});

test('muted primary indigo keeps white button text above WCAG AA contrast', async () => {
  const css = await read('../src/index.css');
  const match = css.match(/button\[class~="bg-indigo-600"\],[\s\S]*?background-color:\s*(#[0-9a-f]{6})/i);
  assert.ok(match, 'primary button color token exists');
  const channel = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = channel(match[1]);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const contrast = 1.05 / (luminance + 0.05);
  assert.ok(contrast >= 4.5, 'white text contrast is ' + contrast.toFixed(2) + ':1');
});

test('shared dialog surfaces stay scrollable on short screens and declare modal semantics', async () => {
  const [css, appDialogs, confirmDialog, studyDialog, unsavedDialog] = await Promise.all([
    read('../src/index.css'),
    read('../src/appDialogs.tsx'),
    read('../src/ConfirmDialog.tsx'),
    read('../src/StudyDialog.tsx'),
    read('../src/UnsavedDialog.tsx'),
  ]);
  assert.match(css, /\.dialog-surface\s*\{[^}]*max-height:\s*min\(88dvh/);
  assert.match(css, /\.dialog-surface\s*\{[^}]*overflow-y:\s*auto/);
  for (const source of [appDialogs, confirmDialog, studyDialog, unsavedDialog]) {
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /dialog-surface/);
  }
});


test('Mission Control learning map stays visible on desktop and mobile without a hide toggle', async () => {
  const map = await read('../src/MissionControl.tsx');
  assert.doesNotMatch(map, /mapExpanded|Hide learning map|Explore learning map/);
  assert.match(map, /bg-\[#0b1221\]\/65 lg:block/);
  assert.match(map, /min-h-\[480px\] shrink-0 overflow-visible[\s\S]*lg:hidden/);
  assert.match(map, /visibleRows\.length === 0 &&/);
});
