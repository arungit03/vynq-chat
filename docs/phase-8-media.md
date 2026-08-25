# Phase 8 — Image and video messaging

## Supported media

- Images: JPEG, PNG, and WebP. The browser scales and compresses selected images to a maximum 2048-pixel edge and a 5 MB final size.
- Videos: MP4 and WebM, up to 50 MB and 30 seconds.
- The file chooser uses standard browser or device camera consent. Vynq does not request camera or library access until the user explicitly selects an action.

## Secure upload flow

1. The client validates and previews the selected media locally. Image previews are object URLs held only in memory.
2. `createMediaUpload` verifies the friend conversation and creates a server-only, 15-minute upload ticket.
3. Storage Rules permit one create-only write only for the exact ticket owner, conversation, message ID, byte size, MIME type, and `media` path.
4. The browser uploads to `conversations/{conversationId}/messages/{messageId}/media` with a resumable upload and visible progress.
5. `finalizeMediaUpload` rechecks the Storage metadata and file signatures. It parses MP4/WebM container metadata and rejects videos above 30 seconds before the Firestore message becomes visible.
6. The ticket is deleted and the finalized media message receives the normal server-controlled 24-hour expiry.

No download URL is stored in Firestore. Chat rendering retrieves an authenticated Storage blob and keeps its object URL only for the mounted UI component.
Conversation-list previews are generic (for example, `New message`), never message text.

## Deletion behavior

- Closing a selected preview before sending creates no Firebase data.
- Cancelling or failing an upload removes its upload ticket and Storage object through Cloud Functions.
- Storage Rules do not let clients delete or overwrite chat media.
- The `deleteMessageMedia` Firestore deletion trigger removes the exact media object when a message document is deleted.
- `purgeExpiredChatMedia` runs every 15 minutes. It removes expired message documents, associated media objects, and abandoned upload tickets. Expired media is inaccessible through Firestore and Storage Rules before that cleanup runs.
- The chat workspace has a local expiry timer, so media disappears at its exact `expiresAt` time and its in-memory object URL is revoked before scheduled cleanup completes.
