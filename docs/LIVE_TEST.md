# Live Test — setup & how it works

One host runs a test for 100+ people at once; at the end the host downloads a ranking PDF (highest marks first).

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
      match /players/{phone} {
        allow create, update: if request.auth != null && request.resource.data.uid == request.auth.uid;
        allow read: if isLiveHost(code) || resource.data.uid == request.auth.uid;
      }
      match /submissions/{phone} {                 // create-only → one submission per phone
        allow create: if request.auth != null
          && request.resource.data.uid == request.auth.uid
          && get(/databases/$(database)/documents/liveTests/$(code)).data.status == 'running';
        allow read: if isLiveHost(code);
      }
    }
```

## Flow
- Host: Test tab → **Live** on any test → Create session → share code/link → Start → End → ranking + PDF.
- Participant: opens `/live/CODE` → name + 10-digit phone → waits → takes test → submits (auto-submits when time ends).

## Design notes
- No new `api/` function (Vercel Hobby is at 12/12) — the browser talks to Firestore directly.
- Answer key is only in `liveTests/{code}/private/paper` (host-only). Grading happens on the host's device.
- Phone number is **not OTP-verified** (SMS auth needs the Blaze plan, which this project avoids). It is only an identifier / duplicate guard and is shown in the PDF.
- Only auto-gradable questions are used: MCQ with an answer key, and short-answer with `acceptedAnswers`. Self-marked subjective questions are skipped.
- Ranking: marks (desc) → faster time → name. Equal marks AND time share a rank. People who joined but did not submit are listed last.
- Countdown is synced to the host's start time using a server-clock offset measured when each participant joins.
