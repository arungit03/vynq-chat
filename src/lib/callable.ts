/**
 * Thin wrapper around Firebase callable functions.
 */
'use client'

import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions } from '@/lib/firebase/client'

export async function callFunction<T = Record<string, never>, R = unknown>(
  name: string,
  data: T,
): Promise<R> {
  const fn = httpsCallable<T, R>(getFirebaseFunctions(), name)
  const res = await fn(data)
  return res.data
}

/** Map a callable failure (Firebase Functions error) to a friendly message. */
export function mapFunctionError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: string }).code)
    const detail = (error as { details?: string }).details
    // httpsCallable wraps thrown HttpsError with code functions/<name>.
    if (detail) return detail
    const known: Record<string, string> = {
      'functions/already-exists': 'That username is already taken',
      'functions/permission-denied': 'You do not have permission to do that',
      'functions/unauthenticated': 'Please sign in again',
      'functions/not-found': 'Not found',
      'functions/aborted': 'Please try again',
      'functions/rate-limit-exceeded': 'Too many attempts. Please slow down.',
    }
    if (known[code]) return known[code]
  }
  return fallback
}
