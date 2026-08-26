# Phase 10 — automatic deletion and privacy protection

## Database protection

All application tables use PostgreSQL Row Level Security. Profiles expose only searchable identity fields. Conversations, messages, requests, statuses, viewers, presence, and typing are scoped to the authenticated user and friendship membership.

The client filters expired records immediately. RLS also checks expiration, so an expired message or status cannot be read even if the cleanup job has not run yet.

## Storage protection

`private-media` is non-public. Storage policies validate chat membership, status friendship, and folder ownership. The client never creates public URLs or exposes a service-role key.

## Cleanup

`supabase/functions/cleanup-expired` runs with the service-role key, finds expired messages and statuses, removes their exact Storage paths, and then deletes the database rows. It is designed to be idempotent and should be scheduled every five minutes with Supabase Cron.

## Abuse controls

The database functions validate username format, relationship state, media type, byte limits, video duration, and message length. Add an external rate limiter or an Edge Function rate-limit table before opening the app to high-volume public traffic.

## Operational boundary

Automatic deletion does not erase screenshots, copied text, browser or OS notification history, or provider backups. The product is private-by-access-control and short-lived; it must not be advertised as end-to-end encrypted.
