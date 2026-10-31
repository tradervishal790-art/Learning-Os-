// Long recordings are spooled to IndexedDB instead of piling up in memory; audio is never lost or reordered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const blobOf = (n, fill) => new Blob([new Uint8Array(n).fill(fill)], { type: 'audio/webm' });
const bytes = async (parts) => new Uint8Array(await new Blob(parts).arrayBuffer());

test('spool: short recording stays in memory; long one is spilled to IndexedDB and read back in order', async () => {
  const { ChunkBuffer, idbSpool } = await loadTs('src/recordingSpool.ts');

  const short = new ChunkBuffer('short', idbSpool, 1000);
  short.add(blobOf(100, 1));
  assert.equal(short.spilled, false);
  assert.equal((await bytes(short.collectInMemory())).length, 100);

  const long = new ChunkBuffer('long', idbSpool, 1000);
  for (let i = 1; i <= 7; i++) long.add(blobOf(400, i)); // 2800 bytes -> spills twice, remainder in memory
  assert.equal(long.spilled, true);
  const all = await bytes(await long.collect());
  assert.equal(all.length, 2800);
  assert.deepEqual([all[0], all[400], all[800], all[2799]], [1, 2, 3, 7], 'chunks keep their order');
  assert.equal((await idbSpool.readAll('long')).length > 0, true, 'groups really are in the database');
  await long.dispose();
  assert.equal((await idbSpool.readAll('long')).length, 0, 'dispose empties the spool');
});

test('spool: when the store refuses a write the audio stays in memory, nothing is lost', async () => {
  const { ChunkBuffer } = await loadTs('src/recordingSpool.ts');
  const mem = new Map();
  let calls = 0;
  const flaky = {
    async put(id, seq, blob) { calls++; if (seq === 1) throw new Error('QuotaExceededError'); mem.set(seq, blob); },
    async readAll() { return [...mem].map(([seq, blob]) => ({ seq, blob })); },
    async clear() { mem.clear(); },
  };
  const b = new ChunkBuffer('x', flaky, 500);
  for (let i = 1; i <= 6; i++) b.add(blobOf(300, i)); // groups of 2 chunks: seq 0 ok, seq 1 refused, seq 2 ok
  const all = await bytes(await b.collect());
  assert.equal(all.length, 1800);
  assert.deepEqual([all[0], all[300], all[600], all[900], all[1200], all[1500]], [1, 2, 3, 4, 5, 6]);
  assert.ok(calls >= 3);
});
