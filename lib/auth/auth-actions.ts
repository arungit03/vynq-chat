import {
  applyActionCode,
  checkActionCode,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
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

type GoogleAuthResult = {
  user: User;
  needsUsername: boolean;
};

function usernameSuggestion(value: string | null | undefined) {
  const suggestion = normalizeUsername((value ?? "").replace(/[^a-zA-Z0-9._]/g, ""));
  return suggestion.length >= 3 ? suggestion.slice(0, 24) : "vynquser";
}

export function suggestedUsernameForUser(user: Pick<User, "displayName" | "email" | "uid">) {
  return usernameSuggestion(user.displayName) || usernameSuggestion(user.email?.split("@")[0]) || `vynq${user.uid.slice(0, 8).toLowerCase()}`;
}

async function claimUsername(username: string, displayName: string) {
  const callable = httpsCallable<{ username: string; displayName: string }, ClaimUsernameResponse>(functions, "claimUsername");
  return callable({ username, displayName });
}

export async function registerWithUsername({ username, email, password }: { username: string; email: string; password: string }) {
  const normalizedUsername = normalizeUsername(username);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

  try {
    await claimUsername(normalizedUsername, normalizedUsername);
    await sendEmailVerification(credential.user, verificationActionSettings());
    return credential.user;
  } catch (error) {
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  const additionalInfo = getAdditionalUserInfo(result);

  // A Google account is already email-verified. The profile is still created
  // by the server after the user chooses a unique Vynq username.
  return {
    user: result.user,
    needsUsername: additionalInfo?.isNewUser === true,
  };
}

export async function claimUsernameForCurrentUser(username: string, displayName: string) {
  return claimUsername(normalizeUsername(username), displayName.trim() || normalizeUsername(username));
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
  // Read the target email before consuming the one-time code. Once the code
  // is applied, checkActionCode correctly reports it as already used.
  const info = await checkActionCode(auth, code);
  await applyActionCode(auth, code);
  return info.data.email ?? null;
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
    "auth/network-request-failed": "Firebase could not reach the authentication service. Check your connection and try again.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication.",
    "auth/invalid-api-key": "Firebase configuration is invalid. Check the web app environment variables.",
    "auth/app-not-authorized": "This app domain is not authorized in Firebase Authentication.",
    "auth/internal-error": "Firebase Authentication had an internal error. Please try again.",
    "auth/popup-closed-by-user": "Google sign-in was canceled before it finished.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in popup. Allow popups and try again.",
    "auth/cancelled-popup-request": "Another Google sign-in window is already open.",
    "auth/account-exists-with-different-credential": "An account already uses this email with another sign-in method. Sign in with that method first.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "functions/already-exists": "That username is already taken.",
    "functions/invalid-argument": "Check your username and try again.",
    "functions/not-found": "The username service is not deployed yet. Start the emulator or deploy Functions.",
    "functions/unavailable": "The username service is temporarily unavailable.",
    "functions/unauthenticated": "Your session expired. Please try again.",
    "functions/permission-denied": "This account is not allowed to complete that action yet.",
    "functions/failed-precondition": "This action cannot be completed with the account state currently available.",
    "functions/internal": "The Vynq backend returned an internal error. Please try again.",
    "functions/resource-exhausted": "Too many attempts. Please wait before trying again.",
    "auth/invalid-action-code": "This verification link is invalid or already used.",
    "auth/expired-action-code": "This verification link has expired. Request a new one.",
    "auth/user-disabled": "This account has been disabled.",
  };
  return messages[code] || "Something went wrong. Please try again.";
}
