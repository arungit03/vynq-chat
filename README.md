# Vynq-chat

Vynq-chat is a light-blue, privacy-first WhatsApp-style PWA with Instagram-style friendship, messaging, media, and status interactions. Messages and media are short-lived; Supabase RLS hides expired content and scheduled cleanup removes database rows and Storage objects.

## Stack

- Vite, React, TypeScript, Tailwind CSS, React Router
- Supabase Auth with email verification and Google OAuth
- Supabase PostgreSQL, Row Level Security, Realtime, Storage, and Edge Functions

## Local setup

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The publishable key is safe in the browser only while RLS policies remain enabled. Never expose the Supabase service-role key in Vite variables or client code.

## Supabase setup

1. Create a Supabase project.
2. Enable Email/Password and Google providers under Authentication.
3. Set the Authentication Site URL and redirect URL to `http://localhost:3000/verify-email`, `http://localhost:3000/complete-profile`, and the production equivalents.
4. Install the Supabase CLI, run `supabase login`, link the project, and push the schema:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   npm run supabase:db:push
   ```

5. Deploy `cleanup-expired` and configure a Supabase Cron job to call it every five minutes with `CLEANUP_CRON_SECRET`.

## Quality gate

```bash
npm run verify
```

This runs Supabase privacy/PWA checks, ESLint, TypeScript, and the Vite production build.

See [production deployment and maintenance](docs/production-deployment.md) for the complete release checklist.
