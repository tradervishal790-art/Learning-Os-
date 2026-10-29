# Live Test — setup, access and security

One host runs a test for a class; students join with a phone number and a private, per-student access code. The host grades submissions locally and can download a ranking PDF.

## Required Firebase setup

1. In Firebase Console → Authentication → Sign-in method, enable **Anonymous** sign-in.
2. From the repository root, confirm the Firebase CLI is targeting the intended project, then deploy the rules shipped in this repository:

   ```sh
   firebase use
   firebase deploy --only firestore:rules
   ```

3. Verify the deployed rules against the exact `firestore.rules` file. **Do not paste the older permissive rules snippet from prior instructions**; it allowed signed-in users to read guest-list and completion-marker metadata.

## Host flow

1. Open Test → Live → create a session.
2. Paste allowed students as one phone number per line, or `Name, number`.
3. Each row gets a cryptographically random 8-character **private access code**. Copy that row's code and send it directly to that student. Do not post the whole list of codes in a public group.
4. Students can join at different times and start their own timer. The host can monitor joins/submissions, end the session, and download the ranking PDF.

If an old entry says its code is missing, add that phone number again to issue a code. Re-adding an entry with an existing code preserves that code.

## Student flow

1. Open the host's `/live/CODE` link.
2. Enter full name, the listed phone number, and the private 8-character access code given by the host.
3. Press **Start test** when ready. Refreshing the page reuses the locally saved code and preserves the server-stamped start time.
4. Submit once; a completed attempt cannot be reopened.

A phone number alone is no longer enough to claim a slot. The access code is a bearer secret: anyone it is shared with may be able to use it. Phone numbers are not OTP-verified because this project avoids paid SMS authentication, so hosts should deliver codes privately and verify students separately when identity matters.

## Security and verification notes

- Public session documents contain questions without the answer key. The answer key remains in `liveTests/{code}/private/paper`, readable only by the host.
- Only the host can list the allow-list, players, submissions, and completion markers. A participant can read only their own matching records after the player slot is bound to their authenticated UID.
- Existing allow-list entries created before access codes were introduced need to be re-added before a new participant can join.
- Before relying on production protection, validate create/read/update behavior with the Firebase Emulator and two distinct participant UIDs, then deploy the exact rules to the intended Firebase project.
- No new Vercel API endpoint is used; the browser continues to talk directly to Firestore.
