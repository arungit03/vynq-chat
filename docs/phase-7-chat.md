# Phase 7 — one-to-one realtime chat

Accepted friendships create one conversation whose ID matches the friendship ID. The conversation stores exactly two member UUIDs and its RLS policy allows access only to those members.

- Text messages are validated by `send_message` and expire after 24 hours.
- Supabase Realtime refreshes message and conversation listeners after inserts, updates, and deletes.
- Read timestamps are written only for incoming messages.
- Presence uses a short heartbeat in the `presence` table and is marked offline on pagehide.
- Typing uses the `typing` table and Realtime changes; the UI treats signals older than five seconds as inactive.
- The service worker never caches Supabase, chat, media, or health traffic.
