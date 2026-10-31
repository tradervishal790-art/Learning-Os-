// Photos follow the student to other devices: copied to the account, fetched on demand when missing locally.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const load = () => loadTs('tests/photoSyncEntry.ts', { alias: { './cloudSync': 'tests/fakeCloud.ts' } });
const photo = (n, fill) => new Blob([new Uint8Array(n).fill(fill)], { type: 'image/jpeg' });
const bytes = async (b) => new Uint8Array(await b.arrayBuffer());

test('photo sync: pushed to the account, then restored on a device that does not have it', async () => {
  const m = await load();
  const original = photo(5000, 7);
  await m.putImage('img_1', original, 'diagram.jpg');
  assert.equal(await m.pushImageToCloud('img_1'), true);
  assert.ok(m.store.has('img_img_1'), 'stored as its own document');

  await m.deleteImage('img_1'); // "another device": nothing local
  const back = await m.getImage('img_1');
  assert.ok(back, 'fetched from the account');
  assert.equal(back.type, 'image/jpeg');
  assert.deepEqual(await bytes(back), await bytes(original), 'identical bytes');

  const pulls = m.stats.pulls;
  await m.getImage('img_1'); // now cached on the device
  assert.equal(m.stats.pulls, pulls, 'second open does not ask the cloud again');
});

test('photo sync: unknown photos are looked up once a minute, big photos stay on the device, delete removes the copy', async () => {
  const m = await load();
  assert.equal(await m.getImage('nope'), null);
  const pulls = m.stats.pulls;
  assert.equal(await m.getImage('nope'), null);
  assert.equal(m.stats.pulls, pulls, 'a miss is remembered for a while');

  await m.putImage('big', photo(m.IMAGE_CLOUD_MAX_BYTES + 1, 1), 'big.jpg');
  assert.equal(await m.pushImageToCloud('big'), false);
  assert.equal(m.store.has('img_big'), false);

  await m.putImage('small', photo(100, 2), 's.jpg');
  await m.pushImageToCloud('small');
  assert.ok(m.store.has('img_small'));
  await m.deleteImageFromCloud('small');
  assert.equal(m.store.has('img_small'), false);
  assert.equal(await m.pushImageToCloud('missing-locally'), false);
});
