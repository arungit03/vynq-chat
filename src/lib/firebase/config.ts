// Firebase web config sourced from environment variables.
// These are the *public* web-app values (safe to ship to the browser) but must
// come from env vars, never hardcoded. Guard against missing config.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

if (!isFirebaseConfigured) {
  // Surface a clear, non-crashing warning so the app can still render the
  // "configure Firebase" guidance instead of a blank screen.
  console.warn(
    "[Vynq-chat] Firebase environment variables are missing. Copy .env.example to .env and fill in your Firebase web config. See README.",
  );
}

export default firebaseConfig;
