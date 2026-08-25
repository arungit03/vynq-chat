# Vynq-chat — Phase 3 Firebase Foundation

**Status:** Implemented  
**Firebase project:** `vynq-chat`  
**Region:** `us-central1`  
**Web SDK style:** Modular Firebase JavaScript SDK

## What is configured

- Firebase Web SDK environment variables in `.env.local`.
- `.env.example` for future machines and teammates.
- Browser-safe Firebase singleton for Authentication, Firestore, Storage, Realtime Database, Cloud Functions, and Analytics.
- Local Emulator Suite connection switches.
- Firebase CLI project alias and deployment manifest.
- Firestore Security Rules and indexes.
- Cloud Storage Security Rules.
- Realtime Database rules for ephemeral presence and typing state.
- TypeScript Cloud Functions workspace using Node.js 22 and 2nd-gen Functions APIs.
- A `healthCheck` function for a later deployment smoke test.

The client config is intentionally loaded from `NEXT_PUBLIC_*` variables. Firebase web configuration values are identifiers used by the browser; they are not Admin credentials. Authorization still depends on Firebase Authentication and Security Rules. Admin SDK credentials must never be placed in `.env.local`, client code, or any `NEXT_PUBLIC_*` variable.

## One-time Firebase Console setup

In the Firebase Console for `vynq-chat`, confirm or enable:

1. Authentication → Sign-in method → Email/Password.
2. Firestore Database → create the default database in the intended region.
3. Storage → create the default bucket.
4. Realtime Database → create the default database.
5. Analytics → keep enabled for the supplied measurement ID, if analytics is desired.
6. Authentication → authorized domains → add local and production domains.

The application code is ready to connect, but Phase 4 will add the first Auth calls and verification flow.

## Local development

Install the Firebase CLI if it is not already available, then authenticate once:

```bash
npx firebase login
npx firebase use vynq-chat
```

Run the local Firebase services:

```bash
npm run firebase:emulators
```

To connect the browser to those emulators, set this in `.env.local`, restart Next.js, and reload the app:

```env
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

The emulator ports are defined in `firebase.json`:

| Service | Port |
|---|---:|
| Emulator UI | 4000 |
| Authentication | 9099 |
| Firestore | 8080 |
| Realtime Database | 9000 |
| Storage | 9199 |
| Functions | 5001 |

Only set the emulator flag during local development. If a service is not emulated, the Firebase SDK will connect to the live project, so keep the flag and project ID aligned.

## Rules and deployment

Rules are deliberately restrictive. They require a signed-in, email-verified user for app data and only allow chat access through an active friendship. Client code cannot write friendships, usernames, or delete expired records; those operations belong to trusted Functions and later cleanup jobs.

Validate the Functions workspace locally:

```bash
npm --prefix functions install
npm --prefix functions run lint
npm --prefix functions run build
```

Deploy only after reviewing the rules and enabling the required Firebase products:

```bash
npm run firebase:deploy
```

No live deployment is performed as part of Phase 3.

## Environment separation

The repository currently maps the `default` Firebase alias to `vynq-chat`. When a staging project is created, add it without replacing the production alias:

```bash
firebase use --add
```

Then use separate `.env.local` files or deployment-provider environment settings for staging and production. Never commit `.env.local`.

## Retention follow-up

`expiresAt` indexes and rules are prepared here. The actual scheduled cleanup and Firestore TTL policy are implemented in the privacy/deletion phase. Firestore TTL alone cannot delete Storage objects or subcollections, so the future cleanup Function must remove those assets explicitly.

