import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('shared intelligence rules keep aggregate reads behind the ten-account floor', () => {
  assert.match(rules, /match \/shared_learning_video_stats\/\{videoId\}[\s\S]*?allow get: if signedIn\(\) && resource\.data\.sampleCount >= 10/);
  assert.match(rules, /match \/shared_learning_patterns\/\{signalId\}[\s\S]*?allow get: if signedIn\(\) && resource\.data\.sampleCount >= 10/);
});

test('shared intelligence collections cannot be listed or deleted by clients', () => {
  assert.match(rules, /match \/shared_learning_video_stats\/\{videoId\}[\s\S]*?allow list, delete: if false/);
  assert.match(rules, /match \/shared_learning_patterns\/\{signalId\}[\s\S]*?allow list, delete: if false/);
});

test('one-time contribution markers are private and immutable after creation', () => {
  assert.match(rules, /match \/users\/\{uid\}\/learningIntelligence\/\{videoId\}[\s\S]*?allow read: if signedIn\(\) && request\.auth\.uid == uid[\s\S]*?allow update, delete: if false/);
  assert.match(rules, /match \/users\/\{uid\}\/learningPatterns\/\{signalId\}[\s\S]*?allow read: if signedIn\(\) && request\.auth\.uid == uid[\s\S]*?allow update, delete: if false/);
});

test('video and pattern writes require paired aggregate increments', () => {
  assert.match(rules, /videoAggregatePaired\(videoId,/);
  assert.match(rules, /patternAggregatePaired\(signalId,/);
  assert.match(rules, /hasNewVideoMarker\(videoId\)/);
  assert.match(rules, /hasNewPatternMarker\(signalId\)/);
  assert.equal((rules.match(/match \/shared_learning_video_stats\//g) || []).length, 1);
  assert.equal((rules.match(/match \/shared_learning_patterns\//g) || []).length, 1);
});

test('the rules file retains its complete service and database closing blocks', () => {
  assert.ok(rules.trimEnd().endsWith('}'));
  assert.ok(rules.includes('match /liveTests/{code}'));
  assert.ok(!rules.includes("videoId.matches('^[A-Za-z0-9_-]{11}\n"));
});
