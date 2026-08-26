import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const failures = [];
function expect(condition, message) { if (!condition) failures.push(message); }

const [manifestSource, serviceWorker, schema, cleanupFunction, authActions, protectedRoute, mediaComposer, statusComposer, modalFocus, supabaseConfig, healthRoute, clientMonitoring, networkStatus] = await Promise.all([
  read("public/manifest.webmanifest"),
  read("public/sw.js"),
  read("supabase/migrations/20260825000000_vynq_schema.sql"),
  read("supabase/functions/cleanup-expired/index.ts"),
  read("lib/auth/auth-actions.ts"),
  read("components/auth/protected-route.tsx"),
  read("components/chat-media-composer.tsx"),
  read("components/status-composer.tsx"),
  read("lib/ui/use-modal-focus.ts"),
  read("lib/supabase/config.ts"),
  read("public/health.json"),
  read("lib/monitoring/client.ts"),
  read("components/network-status.tsx"),
]);
const manifest = JSON.parse(manifestSource);

expect(manifest.display === "standalone", "PWA manifest must use standalone display.");
expect(manifest.start_url === "/", "PWA manifest must define its launch URL.");
expect(serviceWorker.includes('const STATIC_CACHE = "vynq-static-v3"'), "Service worker cache must be versioned.");
expect(serviceWorker.includes('"/offline"') && serviceWorker.includes('caches.match("/offline")'), "Offline page must be precached and used as a navigation fallback.");
expect(serviceWorker.includes("Private data stays network-only"), "Service worker must document private-data network-only handling.");

expect(authActions.includes("supabase.auth.signUp"), "Registration must use Supabase Auth.");
expect(authActions.includes("emailRedirectTo"), "Registration must configure a Supabase email redirect.");
expect(protectedRoute.includes('status === "authenticated"') && protectedRoute.includes('status === "unverified"'), "Protected routes must require a verified email.");
expect(schema.includes("enable row level security"), "Supabase tables must use Row Level Security.");
expect(schema.includes("create or replace function public.claim_username"), "Username claims must be unique and server-validated.");
expect(schema.includes("create or replace function public.cleanup_expired_rows"), "Expired rows must have a database cleanup function.");
expect(schema.includes("storage.objects") && schema.includes("private-media"), "Media must use a private Supabase Storage bucket and policies.");
expect(schema.includes("alter publication supabase_realtime"), "Chat and presence tables must be available to Supabase Realtime.");
expect(cleanupFunction.includes("SUPABASE_SERVICE_ROLE_KEY") && cleanupFunction.includes("storage.from(storageBucket).remove"), "Cleanup must delete expired rows and Storage objects with a server secret.");
expect(mediaComposer.includes("durationSeconds"), "Media composer must carry validated video duration metadata.");
expect(statusComposer.includes("durationSeconds"), "Status composer must carry validated video duration metadata.");
expect(modalFocus.includes('event.key === "Escape"') && modalFocus.includes('event.key !== "Tab"'), "Dialogs must support Escape and contained keyboard focus.");
expect(supabaseConfig.includes("VITE_SUPABASE_URL") && supabaseConfig.includes("VITE_SUPABASE_PUBLISHABLE_KEY"), "Supabase client must use browser environment variables.");
expect(healthRoute.includes('"ok": true') && healthRoute.includes('"service": "vynq-chat-web"'), "The web uptime endpoint must be data-free.");
expect(clientMonitoring.includes("never leave the browser"), "Client error telemetry must avoid private details.");
expect(networkStatus.includes('fetch("/health.json"') && networkStatus.includes("setOffline(!response.ok)"), "Offline UI must confirm an actual app connectivity failure.");

if (failures.length) {
  console.error("Quality checks failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Quality checks passed: Supabase Auth, RLS, Realtime, private media, expiration cleanup, PWA, and accessibility.");
}
