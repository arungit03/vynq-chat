# Vynq-chat product architecture

## Product promise

Vynq is a light-blue, WhatsApp-style private chat PWA with Instagram-style discovery and friendship. Users find one another by unique username, send a request, and unlock a one-to-one conversation only after acceptance.

## Privacy rules

- Email addresses are used by Supabase Auth and are never searchable in the app.
- Usernames are unique, lowercase, 3-24 characters, and searchable only by authenticated users.
- Only accepted friends can read conversations, send messages, view statuses, or download private media.
- Text messages, media, and statuses expire after 24 hours. The client hides them at the exact expiry time and the cleanup worker removes database rows and Storage objects.
- Media is stored in the private `private-media` bucket. The app downloads authenticated blobs and never stores public download URLs.
- Presence and typing are short-lived operational data; they are not a message archive.
- This MVP is not end-to-end encrypted. Supabase administrators and authorized service-role jobs can technically access data while it exists.
- App deletion cannot erase screenshots, copied text, browser caches outside the app, OS notifications, or provider backups.

## Core flows

1. Email signup creates a Supabase Auth user, writes a profile through the database trigger, and sends a verification link.
2. Google OAuth returns to `/complete-profile`. A new Google user chooses a username; an existing profile goes directly to Home.
3. Search resolves an exact username. The user sends a follow request.
4. The recipient accepts or rejects from Profile. Acceptance atomically creates a friendship and conversation.
5. Messages and statuses are written through validated Postgres functions or RLS-protected tables.
6. Realtime streams refresh messages, conversation metadata, statuses, typing, and presence without polling.

## Supabase architecture

| Service | Responsibility |
| --- | --- |
| Supabase Auth | Email/password, email verification, Google OAuth, persistent sessions |
| PostgreSQL | Profiles, requests, friendships, conversations, messages, statuses, viewers, presence, typing |
| PostgreSQL RLS | Membership, ownership, expiration, and write authorization |
| Realtime | Database-change subscriptions plus presence/typing refreshes |
| Storage | Private image/video bucket with folder-based policies |
| SQL functions | Unique username claims, friendship transitions, message/media/status validation |
| Edge Function + Cron | Deletes expired rows and matching Storage objects |
| Vite + React Router | Browser UI, PWA shell, route protection, client Supabase integration |

## Data lifecycle

| Data | Lifetime | Client behavior | Server cleanup |
| --- | --- | --- | --- |
| Text message | 24 hours | Filter by `expires_at` | Delete from `messages` |
| Chat media | 24 hours | Download only while its message is visible | Remove Storage object, then row |
| Status | 24 hours | Filter by `expires_at` | Remove Storage object, then row |
| Status viewer | Status lifetime | Count only while status exists | Cascade with status |
| Typing | Seconds | Realtime signal | Delete when typing stops |
| Presence | Session/heartbeat | Online or last-seen display | Mark offline on pagehide |

The migration in `supabase/migrations/20260825000000_vynq_schema.sql` is the source of truth for tables, constraints, RLS, Storage policies, and server functions.
