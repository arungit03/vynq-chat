/**
 * Shared helpers for A3Chat Cloud Functions.
 */
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import type {
  CallableOptions,
  CallableRequest,
  FunctionsErrorCode,
} from 'firebase-functions/v2/https'

if (admin.apps.length === 0) {
  admin.initializeApp()
}

export const db = admin.firestore()
export const storage = admin.storage()
export const auth = admin.auth()
export const Timestamp = admin.firestore.Timestamp
export const FieldValue = admin.firestore.FieldValue

// ── Retention policy (must match src/lib/constants.ts) ───────
export const MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
export const STATUS_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ── Identity helpers ─────────────────────────────────────────
/** Deterministic, order-independent pair key for 1:1 relationships. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('_')
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/

// ── Callable error helpers ───────────────────────────────────
export type HttpsErrorCode = FunctionsErrorCode

export function fail(code: HttpsErrorCode, message: string): never {
  throw new functions.https.HttpsError(code, message)
}

/**
 * Validate that a callable is invoked by an authenticated, verified user.
 * Returns the caller's uid.
 */
export function requireVerified(request: CallableRequest): string {
  const uid = requireAuth(request)
  const emailVerified = request.auth?.token?.email_verified === true
  if (!emailVerified) fail('permission-denied', 'Verify your email first')
  return uid
}

/** Returns the caller's uid or throws unauthenticated. */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) fail('unauthenticated', 'You must be signed in')
  return request.auth.uid
}

/** Standard callable options. */
export const callableOptions: CallableOptions = {
  enforceAppCheck: false,
  timeoutSeconds: 30,
}

export { functions }
