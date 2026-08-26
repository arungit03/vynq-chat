# Phase 9 — status/story system

Statuses are image or video rows under `statuses/{uid}/{statusId}` in the private Storage bucket. `create_status` validates MIME type, byte size, and the 30-second video limit before the upload begins. `finalize_status` makes the status visible only after upload.

The feed is limited to the current user and accepted friends, filters `expires_at > now()`, and refreshes through Supabase Realtime. Viewer rows use `(status_id, viewer_uid)` as a unique key so viewing a story is idempotent. Expired statuses and their files are removed by `cleanup-expired`.
