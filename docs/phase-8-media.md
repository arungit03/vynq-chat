# Phase 8 — private image and video messaging

The browser prepares images and validates video duration before upload. SQL functions repeat type, byte, relationship, and 30-second checks before creating an uploading message row.

1. `create_media_message` creates a short-lived upload record and exact path under `chat/{conversation}/{uid}/{message}`.
2. The browser uploads to the private `private-media` Supabase bucket with the authenticated session.
3. `finalize_media_message` changes the row to `ready`, making it visible to the conversation.
4. Failed or cancelled uploads remove the row and exact Storage object.
5. `download` returns an authenticated blob held in memory by the mounted media component.

No public URL is saved in the database. Storage RLS checks conversation membership and path ownership.
