# Phase 7 — One-to-one realtime chat

## Conversation model

- A conversation uses the deterministic accepted-friendship ID: the sorted pair of member UIDs.
- `conversations/{friendshipId}` stores `memberUids`, `status`, timestamps, and a short `lastMessagePreview`.
- Each message lives at `conversations/{friendshipId}/messages/{messageId}`.
- Messages currently support text only. Media upload and 30-second validation are reserved for the media phase.

## Message lifecycle

- The browser calls the `sendMessage` Cloud Function; it never writes a message directly.
- The Function verifies the email, conversation membership, active friendship conversation, message length, and text content.
- New messages receive a server timestamp and an `expiresAt` timestamp 24 hours later.
- The client queries only messages whose `expiresAt` is in the future and displays the timestamp plus a read receipt.
- The cleanup worker remains part of the privacy/deployment phase so expired Firestore documents and Storage objects are physically removed, not only hidden by rules.

## Realtime signals

- Firestore `onSnapshot` streams conversation metadata and messages without refresh.
- Realtime Database stores owner-only `presence/{uid}` and `typing/{conversationId}/{uid}` signals.
- Presence uses `.info/connected` and `onDisconnect` to switch users offline when their connection drops.
- Incoming messages are marked read with a server timestamp when rendered by the recipient.
- The Profile privacy controls include a browser notification permission action. When enabled, the active chat can show a quiet notification for a new incoming message while the tab is hidden.

## Privacy rules

- Only verified members can read a conversation or an unexpired message.
- Clients cannot write conversation metadata or delete messages.
- A message read update may only change `readAt` on an unexpired message sent by the other member.
- RTDB presence and typing writes are restricted to the authenticated owner of each signal.
