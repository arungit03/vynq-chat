# Phase 5 — Profiles and social connections

## Data model

- `users/{uid}` stores the private-by-default profile created during registration.
- `usernames/{normalizedUsername}` is the server-owned username index.
- `followRequests/{fromUid_toUid}` stores a directed request with `pending`, `accepted`, `rejected`, or `cancelled` status.
- `friendships/{sortedUidA_sortedUidB}` is created only when the recipient accepts a request.
- `conversations/{sortedUidA_sortedUidB}` is bootstrapped on acceptance so the next chat phase has a stable conversation ID.

## Client behavior

- Search resolves an exact normalized username and shows no public people directory.
- Profile pages show the user identity and the relationship action.
- The Profile panel shows incoming requests, accept/reject actions, friends, followers, and following.
- Home uses accepted friends as the conversation list and shows a private empty state when no friendship exists.

## Server authority

`sendFollowRequest`, `respondToFollowRequest`, and `cancelFollowRequest` are callable Functions. They require an authenticated, verified email account. The accept transaction updates the request, creates the friendship, and prepares the conversation atomically.
