/**
 * Centralized Firebase configuration pulled from environment variables.
 *
 * Values are read at build time via NEXT_PUBLIC_* so they are embedded in the
 * client bundle. Never import process.env directly in components — use these
 * helpers instead.
 */

export interface FirebaseEnv {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const

export function readFirebaseEnv(): FirebaseEnv {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase environment variables: ${missing.join(
        ', ',
      )}. Copy .env.example to .env.local and fill them in.`,
    )
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
  }
}

/** True when the app should connect to the Firebase Emulator Suite. */
export const isEmulator =
  process.env.NEXT_PUBLIC_EMULATOR === 'true' ||
  process.env.NEXT_PUBLIC_EMULATOR === '1'

/** Optional App Check reCAPTCHA v3 site key (production). */
export const appCheckRecaptchaKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_KEY

/** Optional FCM web push VAPID key (production push notifications). */
export const messagingVapidKey = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_VAPID_KEY

/** Optional App Check debug token (development / emulator). */
export const appCheckDebugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN

/** Human-readable feature flag — true when running the emulator locally. */
export const EMULATOR_HOST = '127.0.0.1'
export const EMULATOR_AUTH_PORT = 9099
export const EMULATOR_FIRESTORE_PORT = 8080
export const EMULATOR_STORAGE_PORT = 9199
