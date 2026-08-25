# Vynq-chat — Phase 1 Product Scope, Privacy Rules, and Architecture

**Status:** Approved foundation  
**Date:** 2026-08-24  
**Product:** Vynq-chat  
**Implementation target:** Next.js + React + TypeScript + Tailwind CSS + Firebase

This document is the source of truth for the first implementation. Later UI and backend work should follow these decisions unless a new product decision explicitly changes them.

## 1. Product definition

Vynq-chat is a privacy-first, one-to-one social chat PWA. Its interaction model is familiar like WhatsApp: a conversation list, an active chat pane, media messages, status updates, and fast mobile navigation. Its relationship model is closer to Instagram: people find one another by username, send a follow request, and unlock the private chat after the request is accepted.

The product is intentionally ephemeral. Messages, message media, and statuses are not a permanent archive. The app hides expired content immediately at the client and removes the corresponding Firebase records and files through backend cleanup.

### MVP includes

- Email/password registration with a unique username.
- Required email verification before entering the application.
- Login, logout, protected app routes, and session persistence.
- Username search for signed-in, verified users.
- Follow request, accept, reject, cancel, unfollow, and block flows.
- One-to-one text, image, and video chat after friendship is accepted.
- Image and video status updates visible to accepted friends.
- A maximum video duration of 30 seconds for both chat videos and status videos.
- Automatic message and media expiration after 24 hours.
- Automatic status expiration after 24 hours.
- WhatsApp-inspired desktop split view and a mobile-first installable PWA.
- Light-blue brand accent; no WhatsApp-green visual system.

### Deliberately outside the first MVP

- Group chats.
- Voice or video calls.
- Public follower feeds or recommendations.
- Public status discovery.
- Message forwarding, quoting, editing, or permanent bookmarks.
- End-to-end encryption. The first release uses Firebase Authentication, Security Rules, TLS, Firebase encryption at rest, and aggressive retention limits. E2EE can be a separately designed and audited phase; it must not be implied by the word “private.”

## 2. Core user flows

### Registration and entry

1. A visitor chooses **Create account**.
2. They enter a username, email, and password. A second confirm-password field is intentionally not required.
3. The username is normalized to lowercase for uniqueness checks. Usernames are case-insensitive and use `a-z`, `0-9`, periods, and underscores, with a length of 3–24 characters.
4. Firebase Authentication creates the account. The app sends an email verification link.
5. The user remains in a verification screen until `emailVerified` is true and the session is refreshed.
6. Only then can the user enter Home, Search, Status, or Profile.

The username is immutable in the MVP. The display name, profile photo, and short bio can be edited later without changing the username identity.

### Finding and becoming friends

1. A verified user opens **Search** and searches by exact or prefix username.
2. Search results expose only the minimum public profile information: username, display name, and avatar.
3. The user selects **Follow**.
4. The target receives a pending follow request.
5. The target may accept, reject, or block the request.
6. On acceptance, a deterministic friendship record and one-to-one conversation record are created.
7. Both users see the friend in Home and can open the conversation.
8. A rejected or cancelled request does not unlock chat. A block removes access in both directions.

### One-to-one chat

1. Home shows the user’s accepted friends and recent conversations with active, non-expired activity.
2. On desktop, the conversation list is on the left and the active chat is on the right. On mobile/PWA, the app uses a single-pane conversation route with a back action.
3. A user can send text, an image, or a video up to 30 seconds.
4. Only the two members of the accepted friendship can read or write messages in that conversation.
5. Messages show delivery/read state while the message exists. No message preview is stored permanently in the conversation record.
6. At expiry, the client stops rendering the message and its media even if backend cleanup has not completed yet.

### Status

1. A verified user opens **Status** and uploads an image or a video.
2. Videos are rejected if they exceed 30 seconds; the client checks this before upload and the backend validates it again.
3. A status is visible only to accepted friends in the MVP.
4. Viewers can mark a status as seen while it is active.
5. The status and its media expire 24 hours after publishing.

## 3. Retention and deletion policy

### Product rules

| Data | Expiration clock | User-visible behavior | Backend cleanup |
|---|---:|---|---|
| Text message | 24 hours after send | Hidden at `expiresAt` | Delete Firestore message document |
| Chat image/video | Same `expiresAt` as its message | Preview unavailable at expiry | Delete Storage object, thumbnail, and message document |
| Status image/video | 24 hours after publish | Removed from Status immediately at expiry | Delete status document, viewers, and Storage objects |
| Typing/presence | Seconds/minutes | Stops when inactive or disconnected | No durable retention; use Realtime Database TTL-like cleanup |
| Follow request | Until action or cancellation | Visible to sender/recipient only | No automatic 24-hour deletion requirement |
| Friendship | Until unfollow/block/removal | Keeps the relationship, not message history | Relationship metadata may remain until removed |

Expiration is based on the server timestamp, not a device clock. The 24-hour period is not extended because a message is unread, viewed, downloaded, or replied to. Expired messages are not recoverable through the product.

### Deletion implementation

Every expiring Firestore document carries an `expiresAt` timestamp. The client uses it to hide content immediately. Firestore TTL is a secondary cleanup mechanism, not the only privacy mechanism: Firebase documents that TTL deletion is not instantaneous and is typically completed within 24 hours after expiration. TTL also does not delete subcollections, so it cannot remove media files from Cloud Storage by itself. See the official [Firestore TTL documentation](https://firebase.google.com/docs/firestore/ttl).

The backend will therefore use both:

- A Firestore TTL policy on expiring top-level message/status documents.
- A scheduled Cloud Function that runs frequently, finds expired content, deletes associated Cloud Storage objects and thumbnails, deletes nested viewer/receipt data, and removes orphaned files.
- A client-side expiration guard that prevents expired content from being displayed while cleanup is pending.
- Storage paths that are derived from the owning conversation/status ID so cleanup can find the exact file without relying on a public URL.

Deleting a parent Firestore document must never be assumed to delete its subcollections or Storage objects. Cleanup must be idempotent: running it twice should be safe.

### Privacy boundaries and honest limitations

- Firestore and Storage access is restricted by Firebase Security Rules and authenticated membership checks. Rules are enforced outside the client; they are not replaced by UI checks. See the official [Firebase Security Rules documentation](https://firebase.google.com/docs/rules/).
- Message text is never placed in push notification payloads, analytics events, URLs, filenames, or application logs.
- The app service worker caches the application shell only. It must not persist message data or media for offline replay.
- Expired content is removed from the app-controlled Firestore and Storage locations. Firebase/provider backups, operating-system notification history, screenshots, screen recordings, copied text, browser memory, and user-exported files are outside the app’s ability to erase.
- The MVP is not end-to-end encrypted. Firebase administrators and permitted backend services can technically access server-side data while it exists. This must be disclosed in the privacy policy.
- The app cannot reliably prevent screenshots or screen recording in a browser/PWA.

## 4. Firebase architecture

### Service responsibilities

| Layer | Responsibility |
|---|---|
| Firebase Authentication | Email/password identity, email verification, session state, verified-user gate |
| Cloud Firestore | Profiles, usernames, requests, friendships, conversations, expiring messages, statuses, and limited read metadata |
| Cloud Storage | Private image/video objects, thumbnails, and temporary media assets |
| Realtime Database | Ephemeral presence and typing indicators; no durable chat content |
| Cloud Functions for Firebase | Server-authoritative username reservation, friendship transitions, validation, cleanup, orphan removal, and privacy-safe notifications |
| Firebase Security Rules | Authentication, relationship membership, field validation, path validation, and read/write authorization |
| Next.js App Router | Web/PWA UI, route protection, responsive app shell, client Firebase SDK integration |

The browser never receives Firebase Admin credentials. Any privileged operation—such as deleting another user’s expired media, reserving a unique username, or finalizing a friendship—runs in Cloud Functions with server-side validation.

Scheduled cleanup will use the Firebase `onSchedule` handler and Cloud Scheduler. See the official [scheduled functions documentation](https://firebase.google.com/docs/functions/schedule-functions).

### Proposed Firestore collections

```text
users/{uid}
usernames/{usernameLower}
followRequests/{fromUid_toUid}
friendships/{sortedUidA_sortedUidB}
conversations/{conversationId}
conversations/{conversationId}/messages/{messageId}
statuses/{statusId}
statuses/{statusId}/viewers/{uid}
blocks/{blockerUid_blockedUid}
reports/{reportId}
```

### Core document shapes

```ts
// users/{uid} — only public-safe profile fields
{
  uid: string,
  username: string,           // normalized, case-insensitive identity
  displayName: string,
  avatarPath: string | null,
  bio: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// usernames/{usernameLower} — unique reservation
{
  uid: string,
  createdAt: Timestamp
}

// followRequests/{fromUid_toUid}
{
  fromUid: string,
  toUid: string,
  status: "pending" | "accepted" | "rejected" | "cancelled",
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// friendships/{sortedUidA_sortedUidB}
{
  memberUids: [string, string],
  status: "active" | "blocked" | "removed",
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// conversations/{conversationId}
{
  memberUids: [string, string],
  friendshipId: string,
  createdAt: Timestamp,
  lastActivityAt: Timestamp | null // no message preview or message body
}

// conversations/{conversationId}/messages/{messageId}
{
  senderUid: string,
  type: "text" | "image" | "video",
  text: string | null,
  storagePath: string | null,
  thumbnailPath: string | null,
  durationSeconds: number | null,
  createdAt: Timestamp,
  expiresAt: Timestamp,       // createdAt + 24 hours; server-authoritative
  readAt: Timestamp | null
}

// statuses/{statusId}
{
  ownerUid: string,
  type: "image" | "video",
  storagePath: string,
  thumbnailPath: string | null,
  durationSeconds: number | null,
  createdAt: Timestamp,
  expiresAt: Timestamp,       // createdAt + 24 hours; server-authoritative
  audience: "friends"
}
```

The exact Firestore indexes and field names can be adjusted during Phase 3, but the privacy invariants must remain unchanged: no public media paths, no permanent message previews, server-controlled expiration, and no access without an active friendship.

### Storage paths

```text
users/{uid}/avatar/{assetId}
conversations/{conversationId}/messages/{messageId}/{assetId}
statuses/{statusId}/{assetId}
```

Storage writes must validate authenticated ownership, MIME type, byte size, and path ownership. Video duration is not safely guaranteed by a client-only check; the backend must validate the uploaded asset metadata before making the message/status visible. Firebase Storage Rules support path authorization and metadata validation; see the official [Cloud Storage Security Rules guide](https://firebase.google.com/docs/storage/security).

The app will not store long-lived public download URLs in Firestore. Media access goes through authenticated Firebase Storage SDK requests and relationship-aware rules.

## 5. Security and authorization model

### Global rules

- Unauthenticated users can access only the authentication and verification screens.
- A user must be signed in and email-verified to query users, create requests, read friendships, read statuses, or access chat data.
- Every client-provided `uid` is compared with the authenticated UID or with a server-verified relationship; client-supplied membership flags are never trusted.
- The client may hide a button, but only Firebase Rules or a trusted Cloud Function may authorize an operation.
- Write validation rejects unknown fields, oversized text, invalid timestamps, future-created messages, invalid media types, and videos over 30 seconds.
- Blocked users cannot search, message, view status, or access media through the blocked relationship.

### Operation ownership

| Operation | Allowed actor |
|---|---|
| Reserve username | Cloud Function during verified registration flow |
| Edit profile | Profile owner |
| Create/cancel request | Request sender |
| Accept/reject request | Request recipient |
| Create/read message | Active friendship member only |
| Upload/read message media | Active friendship member only, while active |
| Create/delete own status | Status owner |
| Read status | Active friend and only before `expiresAt` |
| Mark status seen | Active friend viewing an active status |
| Delete expired content | Scheduled backend cleanup only |
| Report/block | Authenticated user, with server validation |

## 6. UI and interaction foundation

### Visual thesis

Vynq-chat should feel calm, private, and quick: a light-blue accent on quiet white and cool-gray surfaces, with dense but breathable chat layout and restrained motion that clarifies navigation.

### Navigation model

The primary navigation is always understandable as four destinations:

- **Home:** accepted friends and conversations.
- **Search:** username search and follow requests.
- **Status:** create, view, and manage expiring updates.
- **Profile:** account, privacy, blocked users, and logout.

Desktop uses a persistent application shell with the navigation rail/sidebar, conversation list, and active chat workspace. Mobile/PWA uses a compact top bar, single-pane routes, a bottom navigation bar, and safe-area padding. The layout must work with keyboard, touch, mouse, and narrow portrait screens.

### Interaction thesis

- New conversations enter with a short, soft slide/fade so the user understands what changed without visual noise.
- The desktop conversation list and active chat use a restrained shared transition; mobile uses a quick route transition with a clear back action.
- Status rings and request states animate only when their state changes, preserving attention for new activity.

Motion is functional and should respect `prefers-reduced-motion`.

## 7. Phase 1 acceptance criteria

Phase 1 is complete when:

- The MVP boundary and non-goals are written down.
- Registration, follow-request, chat, and status flows have an unambiguous happy path.
- Message, media, and status expiration rules are server-time-based and documented.
- Firestore document ownership and Storage path ownership are defined.
- The design explicitly accounts for Firestore TTL’s delayed behavior and its lack of Storage/subcollection cascade deletion.
- The architecture separates browser Firebase access from privileged Cloud Functions.
- The PWA offline policy prevents message/media persistence.
- The product does not claim end-to-end encryption or guaranteed screenshot prevention.
- Phase 2 can begin without unresolved foundational behavior decisions.

## 8. Next phase

Phase 2 will turn these decisions into the Next.js project setup and light-blue design system: typography, color tokens, spacing, breakpoints, navigation shell, interaction states, and reusable UI primitives.

