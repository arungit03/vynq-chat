# Vynq-chat production deployment and maintenance

## Release architecture

| Layer | Production service | Purpose |
| --- | --- | --- |
| Web/PWA | Firebase App Hosting | Deploys the Next.js application from the `main` branch through Cloud Build, Cloud Run, and Cloud CDN. |
| Firebase backend | Cloud Functions for Firebase, `us-central1` | Server-authoritative social/chat/media writes, scheduled privacy cleanup, and the function health endpoint. |
| Data | Firestore, Realtime Database, Cloud Storage | Protected by the tracked Rules and Firestore indexes. |
| Availability | `/api/health` and `healthCheck` | Data-free health checks for the web app and Functions. |
| Monitoring | Firebase Analytics, App Hosting/Cloud Run logs, Cloud Error Reporting | Anonymous client-fault counts and server/runtime error visibility without storing private content. |

App Hosting is the supported Firebase deployment model for this dynamic Next.js app. It is connected to the GitHub repository's `main` branch and rolls out changes on a push. The committed [apphosting.yaml](../apphosting.yaml) sets production-only client configuration; all values are Firebase web configuration, not Admin credentials.

## One-time production release

1. Upgrade the `vynq-chat` Firebase project to Blaze, enable App Hosting, and ensure the deployer is a project Owner for initial backend creation.
2. In Firebase Console, create the default Cloud Storage bucket before the first backend deployment. The chosen bucket location cannot be changed later. The project must also have the service accounts required by Cloud Functions; if the deployer reports an unknown `PROJECT_ID@appspot.gserviceaccount.com`, have a project Owner complete the Cloud Functions onboarding in the console or restore the missing service account.
3. Reauthenticate the Firebase CLI and check access:

   ```bash
   firebase login --reauth
   firebase projects:list
   ```

4. Deploy Functions, Firestore Rules/indexes, Storage Rules, and Realtime Database Rules:

   ```bash
   npm run firebase:deploy:dry-run
   npm run firebase:deploy:backend
   ```

   The ignored `functions/.env` has the production Realtime Database URL required by the private presence/typing mirror. Review it before this deploy; do not commit it.

5. Create the Firebase App Hosting backend. In its prompts, connect `arungit03/a3chat`, choose `/` as the root directory, `main` as the live branch, enable automatic rollouts, and use the `us-central1` primary region.

   ```bash
   npm run firebase:apphosting:create
   npm run firebase:apphosting:list
   ```

6. Push the reviewed repository state to `main`. App Hosting builds and deploys it. Its initial free URL follows `vynq-chat--vynq-chat.us-central1.hosted.app`; use the exact URL reported by the backend list as the source of truth.
7. Add the deployed App Hosting hostname to Firebase Authentication → Settings → Authorized domains, then enable and verify email/password sign-in.
8. Call the health checks and perform the two-account acceptance flow in [Phase 11 testing](phase-11-testing.md):

   ```bash
   curl https://YOUR_APP_HOST/api/health
   curl https://us-central1-vynq-chat.cloudfunctions.net/healthCheck
   ```

## Custom domain

After the backend has a live URL, add the chosen domain in Firebase Console → Hosting & Serverless → App Hosting → backend → Settings → Add custom domain. The console supplies the exact ownership TXT and routing records; add those exact records at the DNS provider, remove conflicting A/CNAME records, and wait for verification and certificate provisioning. Choose one canonical host (for example, `app.example.com`) and redirect the other host to it.

Then add both the App Hosting hostname and canonical custom domain to Firebase Authentication's authorized domains. SSL certificate renewal is managed by App Hosting after the domain is connected.

## Monitoring, alerts, and maintenance

- Check App Hosting Overview, Usage, build logs, and runtime logs after each rollout. Cloud Error Reporting aggregates App Hosting and Cloud Functions failures.
- Create Cloud Monitoring uptime checks against `/api/health` and the Function `healthCheck` endpoint. Alert on failures, elevated 5xx rate, and any Error Reporting issue. Route alerts to the team email/on-call channel.
- Set a Google Cloud budget and alerts for Functions, Firestore, Storage, Cloud Run, and App Hosting before inviting users.
- Review Firebase Authentication sign-in activity, Firestore/Storage usage, and cleanup job logs weekly. Verify the `purgeExpiredChatMedia` schedule succeeds and expired media is removed.
- Keep App Check disabled until its reCAPTCHA provider is registered and observed. Then set `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`, `NEXT_PUBLIC_ENABLE_FIREBASE_APP_CHECK=true`, and `VYNQ_ENFORCE_APP_CHECK=true` together, followed by a staged rollout.
- The GitHub workflow [verify.yml](../.github/workflows/verify.yml) runs the production verification gate for pull requests and `main`. Protect `main` with this check before enabling automatic rollouts.

## Handoff checklist

- [ ] Firebase CLI authenticated to a project Owner account.
- [ ] Blaze billing, the default Storage bucket, Authentication, Firestore, Realtime Database, Functions, Analytics, and App Hosting enabled.
- [ ] Required Cloud Functions service accounts exist and the deployer can act as them.
- [ ] Backend deployment reports Rules and indexes successfully deployed.
- [ ] App Hosting backend connected to the reviewed GitHub repository and `main` branch.
- [ ] Production Auth authorized domains include the App Hosting and custom hostnames.
- [ ] Live health checks return `200` with no private data.
- [ ] Monitoring alerts and budget alerts configured and tested.
- [ ] Two verified accounts complete registration, friendship, chat, media, status, expiration, and offline/PWA acceptance checks.
- [ ] App Check enabled only after valid client tokens are confirmed.
