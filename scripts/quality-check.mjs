import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const [manifest, serviceWorker, firestoreRules, storageRules, databaseRules, functionsSource, authActions, protectedRoute, mediaComposer, statusComposer, modalFocus, appHosting, healthRoute, clientMonitoring] = await Promise.all([
  read("app/manifest.ts"),
  read("public/sw.js"),
  read("firestore.rules"),
  read("storage.rules"),
  read("database.rules.json"),
  read("functions/src/index.ts"),
  read("lib/auth/auth-actions.ts"),
  read("components/auth/protected-route.tsx"),
  read("components/chat-media-composer.tsx"),
  read("components/status-composer.tsx"),
  read("lib/ui/use-modal-focus.ts"),
  read("apphosting.yaml"),
  read("app/api/health/route.ts"),
  read("lib/monitoring/client.ts"),
]);

const networkStatus = await read("components/network-status.tsx");

expect(manifest.includes('display: "standalone"'), "PWA manifest must use standalone display.");
expect(manifest.includes('start_url: "/"'), "PWA manifest must define its launch URL.");
expect(serviceWorker.includes('const STATIC_CACHE = "vynq-static-v3"'), "Service worker cache must be versioned.");
expect(serviceWorker.includes('"/offline"'), "Offline page must be precached.");
expect(serviceWorker.includes('caches.match("/offline")'), "Navigation failures must fall back to the offline page.");
expect(serviceWorker.includes("Private data stays network-only"), "Service worker must document private-data network-only handling.");

expect(authActions.includes("createUserWithEmailAndPassword"), "Registration must use Firebase email/password auth.");
expect(authActions.includes("sendEmailVerification"), "Registration must send a verification email.");
expect(protectedRoute.includes('status === "authenticated"') && protectedRoute.includes('status === "unverified"'), "Protected routes must require a verified email.");
expect(firestoreRules.includes("allow create: if false;"), "Chat and social writes must remain server-authoritative.");
expect(firestoreRules.includes("resource.data.expiresAt > request.time"), "Expired Firestore messages and statuses must not be readable.");
expect(storageRules.includes("private, max-age=0, no-store"), "Uploaded media must opt out of caching.");
expect(storageRules.includes("validTicketedMedia"), "Chat media uploads must require a server ticket.");
expect(databaseRules.includes("conversationMembers"), "Typing data must be limited to conversation members.");
expect(!databaseRules.includes("numChildren"), "Realtime Database rules must use supported validation methods.");
expect(databaseRules.includes('"$other"') && databaseRules.includes('".validate": false'), "Realtime Database presence and typing records must reject unrecognized fields.");
expect(functionsSource.includes('schedule: "every 5 minutes"'), "Expired private data cleanup must run on a schedule.");
expect(functionsSource.includes("collectionGroup(\"messages\")"), "Cleanup must scan expired messages.");
expect(functionsSource.includes("collection(\"statuses\")"), "Cleanup must scan expired statuses.");
expect(mediaComposer.includes("durationSeconds"), "Media composer must carry validated video duration metadata.");
expect(statusComposer.includes("durationSeconds"), "Status composer must carry validated video duration metadata.");
expect(modalFocus.includes('event.key === "Escape"'), "Dialogs must support Escape to close.");
expect(modalFocus.includes('event.key !== "Tab"'), "Dialogs must keep keyboard focus contained.");
expect(appHosting.includes("runConfig:"), "App Hosting must declare a production run configuration.");
expect(appHosting.includes("NEXT_PUBLIC_USE_FIREBASE_EMULATORS") && appHosting.includes('value: "false"'), "App Hosting must disable local emulators.");
expect(healthRoute.includes('service: "vynq-chat-web"') && healthRoute.includes("Cache-Control"), "The web uptime endpoint must be data-free and uncached.");
expect(clientMonitoring.includes("logEvent") && !clientMonitoring.includes("error.message"), "Client error telemetry must avoid private error details.");
expect(networkStatus.includes('fetch("/api/health"') && networkStatus.includes("setOffline(!response.ok)"), "Offline UI must confirm an actual app connectivity failure.");

if (failures.length) {
  console.error("Quality checks failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Quality checks passed: PWA, auth gates, media privacy, deletion, security rules, modal accessibility, and production readiness.");
}
