# Vynq-chat

Vynq-chat is a light-blue, privacy-first WhatsApp-style PWA with Instagram-style friendship, messaging, media, and status interactions. Messages and media are short-lived and backend cleanup removes expired Firestore records and Storage objects.

## Stack

- Next.js, React, TypeScript, Tailwind CSS
- Firebase Authentication, Firestore, Realtime Database, Storage, Cloud Functions, Analytics
- Firebase App Hosting for production Next.js deployment

## Local setup

```bash
npm install
npm --prefix functions install
Copy-Item .env.example .env.local
npm run dev
```

Fill `.env.local` with the Firebase web configuration for your project. Never commit `.env.local` or Admin credentials.

## Quality gate

```bash
npm run verify
```

This runs privacy/PWA configuration checks, linting, the Next.js production build, and the Functions type-check/build.

## Production

See [production deployment and maintenance](docs/production-deployment.md) for Firebase deployment, App Hosting, monitoring, custom domain, and handoff steps.
