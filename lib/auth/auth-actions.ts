import {
  applyActionCode,
  checkActionCode,
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase/client";

/**
 * Email action (verification) links must return to the app so it can consume
 * the oobCode with applyActionCode. Without handleCodeInApp the link is sent to
 * Firebase's default web handler (unconfigured for a custom domain), so the app
 * never learns the email was verified.
 */
function verificationActionSettings(): ActionCodeSettings {
  return {
    url: `${window.location.origin}/verify-email`,
    handleCodeInApp: true,
  };
}

export const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (!username) return "Choose a username.";
  if (username.length < 3 || username.length > 24) return "Use 3–24 characters.";
  if (!USERNAME_PATTERN.test(username)) return "Use lowercase letters, numbers, periods, or underscores.";
  return null;
}

type ClaimUsernameResponse = { username: string };

export async function registerWithUsername({ username, email, password }: { username: string; email: string; password: string }) {
  const normalizedUsername = normalizeUsername(username);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

  try {
    const claimUsername = httpsCallable<{ username: string; displayName: string }, ClaimUsernameResponse>(functions, "claimUsername");
    await claimUsername({ username: normalizedUsername, displayName: normalizedUsername });
    await sendEmailVerification(credential.user, verificationActionSettings());
    return credential.user;
  } catch (error) {
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }
}

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function resendVerificationEmail(user: User) {
  await sendEmailVerification(user, verificationActionSettings());
}

/**
 * Consumes an email verification link's oobCode. Returns the affected email on
 * success. Throws on invalid or expired codes (surfaced via getAuthErrorMessage).
 */
export async function applyEmailVerificationCode(code: string): Promise<string | null> {
  await applyActionCode(auth, code);
  try {
    const info = await checkActionCode(auth, code);
    return info.data.email ?? null;
  } catch {
    return null;
  }
}

/** True when the supplied query string carries a Firebase email-action code. */
export function extractActionCode(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get("oobCode");
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

export function getAuthErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "An account already uses this email.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "The email or password is incorrect.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "functions/already-exists": "That username is already taken.",
    "functions/invalid-argument": "Check your username and try again.",
    "functions/not-found": "The username service is not deployed yet. Start the emulator or deploy Functions.",
    "functions/unavailable": "The username service is temporarily unavailable.",
    "functions/unauthenticated": "Your session expired. Please try again.",
    "functions/resource-exhausted": "Too many attempts. Please wait before trying again.",
    "auth/invalid-action-code": "This verification link is invalid or already used.",
    "auth/expired-action-code": "This verification link has expired. Request a new one.",
    "auth/user-disabled": "This account has been disabled.",
  };
  return messages[code] || "Something went wrong. Please try again.";
}
