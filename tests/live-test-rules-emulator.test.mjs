import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const projectId = 'demo-learning-os';
const rules = readFileSync('firestore.rules', 'utf8');

test('Firestore blocks allow-list enumeration and phone-only slot claims', async () => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  try {
    const sessionCode = 'ABC234';
    const phone = '9876543210';
    const accessCode = 'ABCDEFGHJKLM';
    const allowedPath = `liveTests/${sessionCode}/allowed/${phone}`;
    const playerPath = `liveTests/${sessionCode}/players/${phone}`;
    const donePath = `liveTests/${sessionCode}/done/${phone}`;

    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'liveTests', sessionCode), {
        hostUid: 'host-uid',
        title: 'Security regression',
        status: 'running',
      });
      await setDoc(doc(db, allowedPath), { phone, name: 'Alice', accessCode });
      await setDoc(doc(db, donePath), { uid: 'participant-uid', phone });
    });

    const hostDb = env.authenticatedContext('host-uid').firestore();
    const participantDb = env.authenticatedContext('participant-uid').firestore();
    const strangerDb = env.authenticatedContext('stranger-uid').firestore();

    await assertSucceeds(getDocs(collection(hostDb, `liveTests/${sessionCode}/allowed`)));
    await assertFails(getDocs(collection(strangerDb, `liveTests/${sessionCode}/allowed`)));
    await assertFails(getDoc(doc(strangerDb, allowedPath)));

    // A syntactically valid but incorrect token must not let someone claim
    // the phone slot, even when the phone is on the host's list.
    await assertFails(setDoc(doc(strangerDb, playerPath), {
      uid: 'stranger-uid',
      name: 'Impersonator',
      phone,
      joinedAt: new Date(),
      accessCode: 'BBBBBBBBBBBB',
    }));

    // The intended participant can claim the slot with the matching token.
    await assertSucceeds(setDoc(doc(participantDb, playerPath), {
      uid: 'participant-uid',
      name: 'Alice',
      phone,
      joinedAt: new Date(),
      accessCode,
    }));

    await assertSucceeds(getDoc(doc(participantDb, allowedPath)));
    await assertFails(getDoc(doc(strangerDb, allowedPath)));
    await assertFails(setDoc(doc(strangerDb, playerPath), {
      uid: 'stranger-uid',
      name: 'Impersonator',
      phone,
      joinedAt: new Date(),
      accessCode,
    }));

    // Completion markers are visible to the owner and host, not other users.
    await assertSucceeds(getDoc(doc(participantDb, donePath)));
    await assertSucceeds(getDoc(doc(hostDb, donePath)));
    await assertFails(getDoc(doc(strangerDb, donePath)));
  } finally {
    await env.cleanup();
  }
});
