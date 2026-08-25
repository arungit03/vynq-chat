# Phase 11 — Testing and optimization

## Automated checks

Run the repeatable quality checks with `npm test`. They protect the PWA manifest and offline fallback, email-verification gate, private media upload path, scheduled expiration cleanup, access rules, and keyboard-modal safeguards.

Run the complete local production gate with `npm run verify`:

```bash
npm run verify
```

It runs the quality checks, application lint/build, and Cloud Functions lint/build. It does not deploy Firebase resources.

## Firebase emulator acceptance checklist

Use two verified test accounts with the Firebase emulators before a release.

| Area | Check | Expected result |
| --- | --- | --- |
| Authentication | Register, verify email, log out, log in, and visit `/home` before verification. | Username is unique; unverified users stay in the verification flow; signed-out users are redirected to sign in. |
| Social | Search a username, send a request, accept and reject requests. | Only the receiver can accept/reject; an accepted pair becomes friends and gains one conversation. |
| Chat | Send text from both accounts, mark it read, type, disconnect and reconnect. | Messages appear in realtime only for friends; read and typing state are private; presence recovers after reconnecting. |
| Media | Try permitted images/videos, a video over 30 seconds, unsupported MIME types, and a second account outside the conversation. | Valid uploads use a short server ticket; invalid media is rejected; non-members cannot read/upload files. |
| Status | Share an image and a short video, view from the friend account, inspect viewer count as owner. | Only friends can load active statuses; a view is recorded once; video is limited to 30 seconds. |
| Expiration | Seed message/status/upload records with a past expiry, then invoke or wait for `purgeExpiredChatMedia`. | Firestore records, status viewers, upload tickets, and Storage files are removed together. |
| Rules/abuse | Attempt direct browser writes to users, follows, conversations, messages, statuses, tickets, and another user’s presence. Burst callable actions. | Direct protected writes are denied; only allowed viewer/read-status and own presence writes work; callables rate-limit abuse. |

## PWA, offline, accessibility, and responsive checks

1. Create a production build, start it with `npm start`, and open Chrome/Edge DevTools → Application. Confirm the manifest is valid, `sw.js` is activated, and the app is installable.
2. After one online visit, use DevTools Network → Offline and navigate to a new route. The `/offline` screen appears; it never exposes cached chat, status, profile, or media data.
3. Test 320 px, 390 px, 768 px, 1024 px, and 1440 px widths. Confirm the mobile navigation is reachable, composer controls fit, and desktop conversation panes do not overflow.
4. Use only the keyboard: Tab/Shift+Tab through sign-in and navigation, open every media/status dialog, then verify focus is trapped, Escape closes it, and focus returns to the trigger.
5. Enable `prefers-reduced-motion`, zoom to 200%, and use a screen reader. Confirm all controls have names, status/error messages are announced, and core tasks remain usable.

Private content is deliberately network-only. Offline support installs the app shell and presents a safe reconnect screen, rather than retaining sensitive messages or media on the device.
