import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

const projectId = 'demo-learning-os';
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules },
});

const videoId = 'abcdefghijk';
const videoStatsPath = ['shared_learning_video_stats', videoId];
const patternId = 'question_mcq';

function account(uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

async function contributeVideo(db) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', 'alice', 'learningIntelligence', videoId), {
    outcome: 'completed',
    feedback: 'like',
    submittedAt: serverTimestamp(),
  });
  batch.set(doc(db, ...videoStatsPath), {
    sampleCount: increment(1),
    earlyDropCount: increment(0),
    partialCount: increment(0),
    nearCompleteCount: increment(0),
    completedCount: increment(1),
    positiveFeedbackCount: increment(1),
    negativeFeedbackCount: increment(0),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return batch.commit();
}

async function contributePattern(db, uid, signal = patternId) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'learningPatterns', signal), {
    bucket: 'high',
    submittedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'shared_learning_patterns', signal), {
    sampleCount: increment(1),
    lowCount: increment(0),
    mediumCount: increment(0),
    highCount: increment(1),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return batch.commit();
}

try {
  const alice = account('alice');
  const bob = account('bob');
  const anonymous = testEnv.authenticatedContext('guest', {
    firebase: { sign_in_provider: 'anonymous' },
  }).firestore();

  await assertSucceeds(contributeVideo(alice));
  await assertFails(contributeVideo(alice));

  await assertSucceeds(getDoc(doc(alice, 'users', 'alice', 'learningIntelligence', videoId)));
  await assertFails(getDoc(doc(bob, 'users', 'alice', 'learningIntelligence', videoId)));
  await assertFails(getDoc(doc(alice, ...videoStatsPath)));

  await assertFails(contributeVideo(anonymous));
  await assertFails(contributePattern(anonymous, 'guest'));
  await assertFails(contributePattern(alice, 'alice', 'private_topic_name'));

  await assertSucceeds(contributePattern(alice, 'alice'));
  await assertFails(contributePattern(alice, 'alice'));

  await assertFails(getDoc(doc(alice, 'shared_learning_patterns', patternId)));
  await assertFails(getDocs(collection(alice, 'shared_learning_patterns')));
  await assertFails(getDocs(collection(alice, 'shared_learning_video_stats')));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const admin = context.firestore();
    await setDoc(doc(admin, 'shared_learning_video_stats', 'lmnopqrstuv'), {
      sampleCount: 9,
      earlyDropCount: 1,
      partialCount: 2,
      nearCompleteCount: 2,
      completedCount: 4,
      positiveFeedbackCount: 4,
      negativeFeedbackCount: 1,
      updatedAt: new Date(),
    });
    await setDoc(doc(admin, 'shared_learning_video_stats', 'zyxwvutsrqp'), {
      sampleCount: 10,
      earlyDropCount: 1,
      partialCount: 2,
      nearCompleteCount: 2,
      completedCount: 5,
      positiveFeedbackCount: 5,
      negativeFeedbackCount: 1,
      updatedAt: new Date(),
    });
    await setDoc(doc(admin, 'shared_learning_patterns', 'question_subjective'), {
      sampleCount: 10,
      lowCount: 2,
      mediumCount: 3,
      highCount: 5,
      updatedAt: new Date(),
    });
  });

  await assertFails(getDoc(doc(alice, 'shared_learning_video_stats', 'lmnopqrstuv')));
  await assertSucceeds(getDoc(doc(alice, 'shared_learning_video_stats', 'zyxwvutsrqp')));
  await assertSucceeds(getDoc(doc(alice, 'shared_learning_patterns', 'question_subjective')));

  console.log('Firestore rules emulator checks passed: paired writes, account privacy, one-time markers, allowlisted signals, no listing, and 10-account read threshold.');
} finally {
  await testEnv.cleanup();
}
