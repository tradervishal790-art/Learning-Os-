import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/Revision.tsx', import.meta.url), 'utf8');

test('revision page lists only overdue and due-today items', () => {
  assert.match(src, /items\.filter\(\(i\) => i\.status === 'overdue' \|\| i\.status === 'due-today'\)/);
  assert.ok(!src.includes('filteredItems'), 'no unfiltered list');
  assert.ok(!src.includes("filter === 'all'"), 'no "all" filter');
});

test('revision page no longer renders the filter tabs, stats strip or recall trend', () => {
  assert.ok(!src.includes('t.revision.filters.upcoming'));
  assert.ok(!src.includes('7-day recall trend'));
  assert.ok(!src.includes('Recall accuracy'));
});
