import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { beginRequest, isLatestRequest, invalidateRequests } = await loadTs('src/requestSequence.ts');

test('only the newest async request may update the learning view', () => {
  const counter = { current: 0 };
  const first = beginRequest(counter);
  const second = beginRequest(counter);
  assert.equal(isLatestRequest(counter, first), false);
  assert.equal(isLatestRequest(counter, second), true);
});

test('changing the learner context invalidates pending work', () => {
  const counter = { current: 0 };
  const pending = beginRequest(counter);
  invalidateRequests(counter);
  assert.equal(isLatestRequest(counter, pending), false);
  const next = beginRequest(counter);
  assert.equal(isLatestRequest(counter, next), true);
});
