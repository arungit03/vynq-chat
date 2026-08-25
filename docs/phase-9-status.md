# Phase 9 - Status / Story system

## What is included

- A friends-only status feed, grouped into WhatsApp-style story sequences.
- Image statuses (JPEG, PNG, WebP) and MP4/WebM video statuses up to 30 seconds.
- Device camera/file-picker actions, local previews, image compression, upload progress, and cancellation.
- A full-screen viewer with time-based progression, keyboard navigation, close controls, and a local expiry timer.
- Per-viewer seen records. Friends receive a viewed ring after all moments in a sequence are seen; owners can see the viewer count for each of their moments.

## Private, server-authoritative upload path

1. `createStatusUpload` requires a verified user and creates a private, server-only upload ticket that lasts 15 minutes.
2. Storage Rules only allow the ticket owner to write its exact byte count, MIME type, and `statuses/{statusId}/media` path once.
3. `finalizeStatusUpload` rechecks Storage metadata and actual file signatures. MP4/WebM duration is parsed on the server, so a client cannot bypass the 30-second limit.
4. The function creates a `statuses/{statusId}` document with a server-controlled `expiresAt` 24 hours later. No public download URL is written to Firestore.
5. The app fetches media as authenticated Storage blobs and keeps their object URLs only in memory.

## Access and expiry

- Only the status owner and accepted friends can read a live status document or its Storage object.
- Browser clients cannot create, alter, or delete status documents or upload tickets directly. They may only add their own immutable seen record to a live status they can read.
- The feed filters by `expiresAt`, and its local minute clock removes expired stories immediately in the interface. Firestore and Storage Rules also deny them at the expiration time.
- The `purgeExpiredChatMedia` scheduled job now also removes expired status documents, media objects, viewer records, and abandoned status upload tickets every 15 minutes. The `deleteStatusMedia` trigger performs the same media cleanup for manual deletion.

## Deploy requirement

Run `npm run firebase:deploy` after reviewing the project configuration. This deploys the new Functions, Firestore rules/index, and Storage rules; status sharing will not work against Firebase until those backend changes are deployed.
