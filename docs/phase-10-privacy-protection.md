# Phase 10 - Automatic deletion and privacy protection

## Guaranteed expiry path

Every message and finalized status receives its expiry on the server, never from a browser client:

- Text and media messages expire exactly 24 hours after the server creates them.
- Status documents and their media expire exactly 24 hours after server finalization.
- Media/status upload tickets expire after 15 minutes, including abandoned uploads.
- The client hides expired content at its exact expiry time. Firestore and Storage Rules deny reads at that same time, even before physical cleanup finishes.

`purgeExpiredChatMedia` runs every 5 minutes with one scheduler instance. It processes up to five 100-item pages per content type per run, deletes Storage objects before their Firestore records, removes status-view records, and clears abandoned tickets. It accepts only the exact server-generated Storage path for each record, so malformed data can never make the cleanup worker delete another object. Firestore delete triggers provide the same Storage cleanup for manual/server deletion.

## Access controls

- Firestore message creation, profile changes, follow-request changes, status creation, upload tickets, and rate-limit documents are server-only. Browser clients cannot bypass validation or choose an expiry.
- A recipient can set `readAt` exactly once on a live message. No other client-side message changes are allowed.
- Status viewers can only write their own immutable `{ uid, seenAt }` record, with no additional data fields.
- Storage accepts only one create-only upload for an unexpired, server-issued ticket with the approved MIME type, bytes, path, and `Cache-Control: private, max-age=0, no-store` metadata. It never permits browser overwrite or deletion.
- Private media is loaded as an authenticated blob; no downloadable URL is saved in Firestore. New browser notifications contain no contact name, text, or media detail.
- Realtime Database presence is readable only by the user or an accepted friend; typing signals are readable/writable only by an authorized conversation member. The accepted-friend Function writes private RTDB access mirrors after it creates the friendship.

## Abuse controls

All privileged callables are authenticated, email-verified (apart from initial username claim), and use durable Firestore transaction rate limits. Current limits include 60 text messages/minute, 12 media uploads/10 minutes, 24 statuses/hour, and restrictive limits for username and connection operations. The rate-limit documents are private and are removed after their cooldown window.

Optional Firebase App Check support is prepared for reCAPTCHA v3. Register App Check for the web app first, then set these values before deployment:

```text
# root .env.local
NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=your-recaptcha-v3-site-key
NEXT_PUBLIC_ENABLE_FIREBASE_APP_CHECK=true

# functions/.env
VYNQ_ENFORCE_APP_CHECK=true
FIREBASE_DATABASE_URL=https://vynq-chat-default-rtdb.firebaseio.com
```

Use Firebase App Check metrics in monitoring mode before setting `VYNQ_ENFORCE_APP_CHECK=true`; enforced App Check rejects every callable that has no valid token. `FIREBASE_DATABASE_URL` is also required so accepted-friend Functions can create the private presence/typing access mirrors.

## Deployment

Review the environment values, then deploy the backend and Rules:

```powershell
npm run firebase:deploy
```

No live Firebase deployment was performed by this phase. Until it is deployed, the local code and the live project will not have matching privacy controls.
