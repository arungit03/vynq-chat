# Vynq-chat — Supabase foundation

The project uses Supabase as its backend. The browser receives only the project URL and publishable key. The service-role key is used only by the cleanup Edge Function.

## Required environment

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

## One-time project setup

1. Create a Supabase project.
2. Enable Email/Password and Google under Authentication providers.
3. Configure Site URL and redirect URLs for `/verify-email` and `/complete-profile`.
4. Install the Supabase CLI and authenticate:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   npm run supabase:db:push
   ```

The migration creates the relational schema, RLS policies, Realtime publication, and private Storage bucket. Review it before applying to production.

## Cleanup deployment

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY CLEANUP_CRON_SECRET=YOUR_RANDOM_SECRET
npm run supabase:functions:deploy
```

Schedule a POST to `functions/v1/cleanup-expired` every five minutes with `x-cleanup-secret`. The worker deletes expired database rows and matching private-media objects.

## Local app

```bash
npm install
npm run dev
```

Use the Supabase dashboard or local Supabase CLI stack for Auth, Postgres, Realtime, and Storage testing. Never put the service-role key in `.env.local` or any `VITE_*` variable.
