# Vynq-chat production deployment and maintenance

## Release architecture

| Layer | Production service | Purpose |
| --- | --- | --- |
| Web/PWA | Any static host | Serves the Vite React SPA, manifest, service worker, and SPA fallback. |
| Auth | Supabase Auth | Email verification, password login, Google OAuth, and sessions. |
| Data | Supabase PostgreSQL | Profiles, friendships, requests, conversations, messages, statuses, and viewers. |
| Realtime | Supabase Realtime | Messages, conversation metadata, typing, presence, and status refreshes. |
| Media | Supabase Storage | Private `private-media` bucket protected by Storage RLS policies. |
| Cleanup | Supabase Edge Function + Cron | Deletes expired database rows and their Storage objects. |

## One-time Supabase setup

1. Create a Supabase project and record its project URL, publishable key, and project ref.
2. Enable Email/Password and Google providers in Authentication.
3. Configure Site URL and redirect URLs for `/verify-email` and `/complete-profile` on localhost and production.
4. Install the Supabase CLI, authenticate, link the project, and apply the migration:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   npm run supabase:db:push
   ```

5. Set the Edge Function secrets:

   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY CLEANUP_CRON_SECRET=YOUR_RANDOM_SECRET
   npm run supabase:functions:deploy
   ```

6. In Supabase Cron, schedule a POST request to `functions/v1/cleanup-expired` every five minutes with `x-cleanup-secret: YOUR_RANDOM_SECRET`. The service-role key must remain a Supabase secret, never a `VITE_*` variable.

## Web deployment

Set these variables in the static host’s build environment:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Build the application and configure the host to serve `dist/index.html` for unknown SPA routes:

```bash
npm run build
```

## Maintenance

- Keep RLS enabled on every public table and review policies before schema changes.
- Keep `private-media` non-public. Do not save public media URLs in database rows.
- Verify cleanup removes both expired rows and Storage objects.
- Rotate `CLEANUP_CRON_SECRET` and service-role credentials if exposed.
- Run `npm run verify` before releases.
- Test two verified accounts through registration, friendship, chat, media, status, expiration, offline, and PWA installation.
