/**
 * Authentication operations wrapping the Firebase Auth JS SDK.
 * All errors are mapped to friendly messages — never raw stack traces.
 */
'use client'

import { getFirebaseAuth } from '@/lib/firebase/client'
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
  'auth/user-not-found': 'No account found for this email.',
  'auth/wrong-password': 'Incorrect password. Try again.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-login-credentials': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this project.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
}

export function mapAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code
    if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code]
  }
  return 'Something went wrong. Please try again.'
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function sendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user)
}

export async function resendVerificationEmail(): Promise<void> {
  const auth = getFirebaseAuth()
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser)
  }
}

export async function reloadUser(user: User): Promise<User> {
  await reload(user)
  return user
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email)
}

export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth())
}
