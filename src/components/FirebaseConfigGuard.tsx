import type { ReactNode } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";

/** If Firebase env vars are missing, render a setup guide instead of crashing. */
export function FirebaseConfigGuard({ children }: { children: ReactNode }) {
  if (!isFirebaseConfigured) {
    return <SetupNotice />;
  }
  return <>{children}</>;
}

function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 p-6">
      <div className="card max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink">Vynq-chat setup needed</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Connect a Firebase project to run the app. Copy <code className="rounded bg-brand-50 px-1 py-0.5 text-brand-700">.env.example</code> to{" "}
          <code className="rounded bg-brand-50 px-1 py-0.5 text-brand-700">.env</code> and add your web config, then restart the dev server.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 text-left text-xs text-brand-100">
{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`}
        </pre>
        <p className="mt-4 text-xs text-ink-muted">
          See the README for full Firebase setup, security rules, and Cloud Functions.
        </p>
      </div>
    </div>
  );
}
