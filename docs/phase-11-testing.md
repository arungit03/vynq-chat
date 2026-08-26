# Phase 11 — testing and optimization

## Automated checks

```bash
npm run verify
```

This validates Supabase configuration expectations, RLS/Storage/Realtime schema markers, auth gates, PWA behavior, accessibility helpers, ESLint, TypeScript, and the Vite production build.

## Manual acceptance checklist

- Create an email account and receive a Supabase verification email.
- Verify the email link, refresh, and enter Home.
- Sign in with Google; a new profile must ask for a unique username, while an existing profile must open Home.
- Search a username, send a request, accept it from a second account, and confirm the conversation appears for both.
- Send text, image, and video messages; reject a video longer than 30 seconds.
- Confirm typing, presence, read state, and Realtime updates between two browser sessions.
- Share image/video statuses, mark them seen, and verify friend-only access.
- Test expired rows through the cleanup function and verify matching Storage objects are gone.
- Install the PWA, test offline shell behavior, keyboard focus, Escape-to-close dialogs, and screen-reader labels.
- Test mobile and desktop layouts, private-bucket access, RLS denial, and production redirect URLs.
