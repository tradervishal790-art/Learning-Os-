import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { segmentIndexAt } = await loadTs('src/conceptTimeline.ts');

test('chapter timeline follows the current playback time and handles boundaries', () => {
  const chapters = [
    { start: 0, title: 'Introduction', summary: '' },
    { start: 60, title: 'Core concept', summary: '' },
    { start: 145, title: 'Worked example', summary: '' },
  ];
  assert.equal(segmentIndexAt(chapters, 0), 0);
  assert.equal(segmentIndexAt(chapters, 59.4), 0);
  assert.equal(segmentIndexAt(chapters, 59.6), 1);
  assert.equal(segmentIndexAt(chapters, 90), 1);
  assert.equal(segmentIndexAt(chapters, 145), 2);
  assert.equal(segmentIndexAt(chapters, 300), 2);
});

test('chapter timeline safely returns the first index for an empty list', () => {
  assert.equal(segmentIndexAt([], 10), 0);
});
