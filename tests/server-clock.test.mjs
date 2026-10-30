import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

test('server clock: a device clock that is a day ahead is corrected; a normal clock is left alone', async () => {
  const { computeOffset, setClockOffset, serverNow } = await loadTs('src/serverClock.ts');
  const real = Date.UTC(2026, 9, 30, 10, 0, 0);
  const header = new Date(real).toUTCString();
  const deviceAhead = real + 86_400_000;
  const off = computeOffset(header, deviceAhead, deviceAhead + 200);
  assert.ok(Math.abs(off + 86_400_000) < 1_500, `offset ~ -1 day, got ${off}`);
  assert.equal(computeOffset(header, real + 700, real + 900), 0, 'within a few seconds = no correction');
  assert.equal(computeOffset(header, real, real + 9_000), 0, 'a slow measurement is not trusted');
  assert.equal(computeOffset('not a date', real, real + 100), 0);
  assert.equal(computeOffset(null, real, real + 100), 0);
  setClockOffset(-86_400_000);
  assert.ok(Math.abs(serverNow() - (Date.now() - 86_400_000)) < 50);
  setClockOffset(0);
});
