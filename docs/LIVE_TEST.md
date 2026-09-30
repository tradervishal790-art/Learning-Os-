# Live Test — setup & how it works

One host runs a test for 100+ people (listed by phone number); at the end the host downloads a ranking PDF (highest marks first).

## One-time Firebase setup (Firebase Console)
1. **Authentication → Sign-in method → Anonymous → Enable.** (Participants join without an account. Free on Spark.)
2. **Firestore → Rules:** ADD the block below inside your existing `match /databases/{database}/documents { ... }` (do not remove your existing rules), then Publish.

```
    function isLiveHost(code) {
      return request.auth != null
        && get(/databases/$(database)/documents/liveTests/$(code)).data.hostUid == request.auth.uid;
    }

    match /liveTests/{code} {
      allow read: if true;   // questions here have NO answer key
      allow create: if request.auth != null && request.resource.data.hostUid == request.auth.uid;
      allow update: if request.auth != null && resource.data.hostUid == request.auth.uid;

      match /private/{doc} {                       // answer key — host only
        allow read, write: if isLiveHost(code);
      }
      match /allowed/{phone} {                     // host's guest list
        allow get: if request.auth != null;        // a student can check only their own number
        allow list, write: if isLiveHost(code);
      }
      match /players/{phone} {
        // only numbers on the guest list; the first device that joins keeps the number
        allow create: if request.auth != null
          && request.resource.data.uid == request.auth.uid
          && exists(/databases/$(database)/documents/liveTests/$(code)/allowed/$(phone));
        allow update: if request.auth != null
          && resource.data.uid == request.auth.uid
          && request.resource.data.uid == request.auth.uid
          // startedAt is stamped once by the server and can never be changed/reset
          && ('startedAt' in resource.data
                ? request.resource.data.startedAt == resource.data.startedAt
                : (!('startedAt' in request.resource.data) || request.resource.data.startedAt == request.time));
        allow delete: if isLiveHost(code);         // host "unlock" for a lost phone
        allow read: if isLiveHost(code) || (request.auth != null && resource.data.uid == request.auth.uid);
      }
      match /done/{phone} {                        // marker: this number already finished
        allow get: if request.auth != null;
        allow list: if isLiveHost(code);
        allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      }
      match /submissions/{phone} {                 // create-only → one submission per phone
        allow create: if request.auth != null
          && request.resource.data.uid == request.auth.uid
          && exists(/databases/$(database)/documents/liveTests/$(code)/allowed/$(phone))
          && get(/databases/$(database)/documents/liveTests/$(code)).data.status == 'running';
        allow read: if isLiveHost(code);
      }
    }
```

## Flow
- Host: Test tab → **Live** on any test → Create session (it is live immediately) → **add allowed phone numbers** (paste one per line, or `Name, number`; you can add more any time) → share code/link → watch On list / Taking now / Submitted → press **End** when you want to close it → ranking + PDF.
- Participant: opens `/live/CODE` at ANY time while the session is live → name + 10-digit phone → accepted only if the host added that number → presses **Start test** when ready → gets the full duration from THEIR own Start → submits (auto-submits when their time ends).
- One attempt per number: after submitting, that number can never open the test again. A number is locked to the first device that joins; the host can press the reset icon next to it if a student's phone dies.
- Ending the session closes it for everyone: students still mid-test at that moment cannot send their answers (the host is warned with a count first).

## Design notes
- No new `api/` function (Vercel Hobby is at 12/12) — the browser talks to Firestore directly.
- Answer key is only in `liveTests/{code}/private/paper` (host-only). Grading happens on the host's device.
- Phone number is **not OTP-verified** (SMS auth needs the Blaze plan, which this project avoids). It is checked against the host's guest list and shown in the PDF; someone who knows an allowed number could still type it, so tell students not to share it.
- Only auto-gradable questions are used: MCQ with an answer key, and short-answer with `acceptedAnswers`. Self-marked subjective questions are skipped.
- Ranking: marks (desc) → faster time → name. Equal marks AND time share a rank. People who joined but did not submit are listed last.
- Each student's countdown starts from a server-stamped `startedAt` on their own player doc (not resettable), corrected with a server-clock offset, and survives refresh.
