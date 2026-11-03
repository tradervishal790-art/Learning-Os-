// #5 (audit) — a cloud write that fails must be remembered, shown, and retried; never silent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

async function setup() {
  const m = await loadTs('tests/syncEntry.ts');
  m.resetSyncStatus();
  return m;
}

test('failed push is remembered with its newest data; retry sends it and clears the notice', async () => {
  const m = await setup();
  const sent = [];
  let online = false;
  m.__setCloudSyncTestHooks({ uid: () => 'u1', write: async (uid, key, data) => { if (!online) throw new Error('offline'); sent.push([uid, key, data]); } });
  await m.pushToCloud('goals', [1]);
  await m.pushToCloud('goals', [1, 2]);
  await m.pushToCloud('revision', { a: 1 });
  assert.equal(m.failedSyncCount(), 2);
  assert.deepEqual(m.failedPushes().find((f) => f.key === 'goals').data, [1, 2], 'newest version kept');
  online = true;
  assert.equal(await m.retryFailedSyncs(), true);
  assert.equal(m.failedSyncCount(), 0);
  assert.deepEqual(sent.map((s) => s[1]).sort(), ['goals', 'revision']);
  assert.deepEqual(sent.find((s) => s[1] === 'goals')[2], [1, 2]);
});

test('success clears the notice; signed-out stays local-only without a false alarm', async () => {
  const m = await setup();
  m.__setCloudSyncTestHooks({ uid: () => null, write: async () => { throw new Error('never called'); } });
  await m.pushToCloud('x', 1);
  assert.equal(m.failedSyncCount(), 0);
  m.__setCloudSyncTestHooks({ uid: () => 'u1', write: async () => {} });
  await m.pushToCloud('x', 2);
  assert.equal(m.failedSyncCount(), 0);
});

test('an older slow write that fails after a newer one succeeded does not raise a false failure', async () => {
  const m = await setup();
  let rejectOld;
  m.__setCloudSyncTestHooks({
    uid: () => 'u1',
    write: (uid, key, data) => (data === 'old' ? new Promise((_, rej) => { rejectOld = rej; }) : Promise.resolve()),
  });
  const oldP = m.pushToCloud('k', 'old');
  await m.pushToCloud('k', 'new'); // newer write lands
  rejectOld(new Error('late failure'));
  await oldP;
  assert.equal(m.failedSyncCount(), 0);
});

test('changes of another account are dropped, never pushed into the wrong account', async () => {
  const m = await setup();
  let who = 'u1';
  const sent = [];
  m.__setCloudSyncTestHooks({ uid: () => who, write: async (uid, key) => { if (who === 'u1') throw new Error('x'); sent.push([uid, key]); } });
  await m.pushToCloud('goals', [1]);
  assert.equal(m.failedSyncCount(), 1);
  who = 'u2';
  assert.equal(await m.retryFailedSyncs(), true);
  assert.deepEqual(sent, []);
});

test('a failed cloud DELETE is remembered and retried too (otherwise the deleted item returns from the cloud)', async () => {
  const m = await setup();
  const removed = [];
  let online = false;
  m.__setCloudSyncTestHooks({
    uid: () => 'u1',
    write: async () => {},
    remove: async (uid, key) => { if (!online) throw new Error('offline'); removed.push([uid, key]); },
  });
  await m.deleteFromCloud('note_1');
  assert.equal(m.failedSyncCount(), 1);
  assert.equal(m.failedPushes()[0].op, 'delete');
  online = true;
  assert.equal(await m.retryFailedSyncs(), true);
  assert.deepEqual(removed, [['u1', 'note_1']]);
  assert.equal(m.failedSyncCount(), 0);
});

test('delete then re-save the same key: the newest action wins (no stale delete is retried)', async () => {
  const m = await setup();
  const written = [];
  m.__setCloudSyncTestHooks({ uid: () => 'u1', remove: async () => { throw new Error('offline'); }, write: async (_u, k) => { written.push(k); } });
  await m.deleteFromCloud('k'); // fails -> remembered
  assert.equal(m.failedSyncCount(), 1);
  await m.pushToCloud('k', { back: true }); // the item was re-created and saved: this lands
  assert.equal(m.failedSyncCount(), 0);
  assert.deepEqual(written, ['k']);
});
