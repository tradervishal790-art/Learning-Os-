import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync('firestore.rules', 'utf8');
const liveTest = readFileSync('src/liveTest.ts', 'utf8');
const liveJoin = readFileSync('src/LiveJoin.tsx', 'utf8');
const liveHost = readFileSync('src/LiveHost.tsx', 'utf8');

test('new allow-list entries get cryptographically random 12-character access codes', () => {
  assert.match(liveTest, /ACCESS_CODE_LENGTH = 12/);
  assert.match(liveTest, /crypto\.getRandomValues\(values\)/);
  assert.match(liveTest, /const oldCode = typeof old\.accessCode === 'string'/);
  assert.match(liveTest, /accessCode: oldCode/);
});

test('Firestore validates access-code shape and keeps allow-list listing host-only', () => {
  const allowed = rules.match(/match \/allowed\/\{phone\} \{([\s\S]*?)\n      \}/)?.[1] ?? '';
  assert.match(allowed, /allow list: if isHost\(\)/);
  assert.match(allowed, /request\.resource\.data\.accessCode\.matches\('\[A-HJ-NP-Z2-9\]\{12\}'\)/);
  assert.doesNotMatch(allowed, /allow get: if signedIn\(\);/);
});

test('a participant cannot create a phone slot without the matching private access code', () => {
  const players = rules.match(/match \/players\/\{phone\} \{([\s\S]*?)\n      \}/)?.[1] ?? '';
  assert.match(players, /request\.resource\.data\.accessCode == get\([\s\S]*?\/allowed\/\$\(phone\)\)\.data\.accessCode/);
  assert.match(players, /request\.resource\.data\.accessCode == resource\.data\.accessCode/);
  assert.match(players, /resource\.data\.get\('accessCode', null\)/);
});

test('public join route authenticates before subscribing to the session', () => {
  assert.match(liveJoin, /ensureSignedIn\(\)\s*\.then\(\(\) => \{[\s\S]*?subscribeSession\(code, setSession\)/);
});

test('participant access code is required, normalized and persisted for refresh', () => {
  assert.match(liveTest, /export function normalizeAccessCode\(/);
  assert.match(liveTest, /joinLiveSession\([\s\S]*?accessCode: string/);
  assert.match(liveTest, /accessCode, joinedAt: serverTimestamp\(\)/);
  assert.match(liveJoin, /value=\{accessCodeInput\}/);
  assert.match(liveJoin, /player\.accessCode \?\? ''/);
  assert.match(liveJoin, /joinLiveSession\(code, n, phone, accessCode\)/);
  assert.match(liveJoin, /\^\[A-HJ-NP-Z2-9\]\{12\}\$/);
});

test('host UI displays and can copy the participant-specific access code', () => {
  assert.match(liveHost, /copyAccessCode/);
  assert.match(liveHost, /navigator\.clipboard\.writeText\(accessCode\)/);
  assert.match(liveHost, /Access: \{a\.accessCode/);
});
