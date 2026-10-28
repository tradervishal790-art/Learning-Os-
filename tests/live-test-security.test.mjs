import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync('firestore.rules', 'utf8');
const liveTest = readFileSync('src/liveTest.ts', 'utf8');

test('live-test allow-list reads require host or ownership of the matching player slot', () => {
  const section = rules.match(/match \/allowed\/\{phone\} \{([\s\S]*?)\n      \}/)?.[1] ?? '';
  assert.match(section, /allow get: if isHost\(\)/);
  assert.match(section, /players\/\$\(phone\)/);
  assert.match(section, /\.data\.uid == request\.auth\.uid/);
  assert.doesNotMatch(section, /allow get: if signedIn\(\);/);
});

test('live-test done markers are not readable across participant UIDs', () => {
  const section = rules.match(/match \/done\/\{phone\} \{([\s\S]*?)\n      \}/)?.[1] ?? '';
  assert.match(section, /resource\.data\.uid == request\.auth\.uid/);
  assert.match(section, /allow list: if isHost\(\);/);
  assert.doesNotMatch(section, /allow get: if signedIn\(\);/);
});

test('participant join writes the player slot before reading allow-list details', () => {
  const join = liveTest.slice(liveTest.indexOf('export async function joinLiveSession'));
  const writeAt = join.indexOf('await setDoc(ref');
  const allowedReadAt = join.indexOf("getDoc(doc(db, 'liveTests', code, 'allowed', phone))");
  assert.ok(writeAt >= 0 && allowedReadAt > writeAt);
});
