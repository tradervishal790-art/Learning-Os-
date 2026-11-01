import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { mergeResolvedChannel } = await loadTs('src/channelDigestLogic.ts');

const channel = (channelId, title = channelId) => ({ channelId, title });

test('channel resolution merges into the latest list and preserves intervening removals', () => {
  const latest = [channel('UC0000000000000000000001', 'Kept')];
  const resolved = channel('UC0000000000000000000002', 'New');
  assert.deepEqual(mergeResolvedChannel(latest, resolved, 5), [...latest, resolved]);
});

test('concurrent duplicate channel resolution does not add a duplicate', () => {
  const existing = channel('UC0000000000000000000001', 'Existing');
  const result = mergeResolvedChannel([existing], channel(existing.channelId, 'Resolved title'), 5);
  assert.deepEqual(result, [existing]);
});

test('channel limit is rechecked after the network request', () => {
  const latest = Array.from({ length: 5 }, (_, i) => channel(`UC000000000000000000000${i}`));
  assert.throws(() => mergeResolvedChannel(latest, channel('UC0000000000000000000099'), 5), /up to 5 channels/);
});
