import type { User } from "@supabase/supabase-js";
import { mapUser, type VynqUser } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";

export const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (!username) return "Choose a username.";
  if (username.length < 3 || username.length > 24) return "Use 3-24 characters.";
  if (!USERNAME_PATTERN.test(username)) return "Use lowercase letters, numbers, periods, or underscores.";
  return null;
}

function emailRedirect(path: string) {
  return `${window.location.origin}${path}`;
}

function usernameSuggestion(value: string | null | undefined) {
  const suggestion = normalizeUsername((value ?? "").replace(/[^a-zA-Z0-9._]/g, ""));
  return suggestion.length >= 3 ? suggestion.slice(0, 24) : "vynquser";
}

export function suggestedUsernameForUser(user: Pick<User, "user_metadata" | "email" | "id">) {
  return usernameSuggestion(user.user_metadata?.display_name) || usernameSuggestion(user.email?.split("@")[0]) || `vynq${user.id.slice(0, 8).toLowerCase()}`;
}

export async function registerWithUsername({ username, email, password }: { username: string; email: string; password: string }) {
  const normalizedUsername = normalizeUsername(username);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { username: normalizedUsername, display_name: normalizedUsername },
      emailRedirectTo: emailRedirect("/verify-email"),
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Supabase did not return a user account.");
  if (data.session) await claimUsernameForCurrentUser(normalizedUsername, normalizedUsername);
  return mapUser(data.user);
}

/** Starts Supabase's hosted Google OAuth flow and redirects back to Vynq. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: emailRedirect("/complete-profile"),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export async function claimUsernameForCurrentUser(username: string, displayName: string) {
  const { data, error } = await supabase.rpc("claim_username", {
    p_username: normalizeUsername(username),
    p_display_name: displayName.trim() || normalizeUsername(username),
  });
  if (error) throw error;
  return data as { username: string };
}

export async function loginWithEmail(email: string, password: string): Promise<VynqUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  const user = mapUser(data.user);
  if (!user) throw new Error("Supabase did not return a user account.");
  return user;
}

export async function resendVerificationEmail(user: Pick<User, "email">) {
  if (!user.email) throw new Error("No email address is attached to this account.");
  const { error } = await supabase.auth.resend({ type: "signup", email: user.email, options: { emailRedirectTo: emailRedirect("/verify-email") } });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: emailRedirect("/login") });
  if (error) throw error;
}

/** Sends a 6-digit email OTP for passwordless sign-in (or sign-up). */
export async function sendEmailOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Exchanges a 6-digit email OTP for a session. */
export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  if (!data.session) throw new Error("Verification did not return a session.");
  return mapUser(data.user);
}

export function getAuthErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    user_already_exists: "An account already uses this email.",
    email_exists: "An account already uses this email.",
    invalid_credentials: "The email or password is incorrect.",
    invalid_email: "Enter a valid email address.",
    weak_password: "Use a stronger password with at least 6 characters.",
    email_not_confirmed: "Verify your email before signing in.",
    otp_expired: "This verification link has expired. Request a new one.",
    over_email_send_rate_limit: "Too many emails were sent. Wait a few minutes or switch to a custom SMTP provider in Supabase.",
    "23505": "That username is already taken.",
    "42501": "Your session expired. Please sign in again.",
    "22023": "Check your username and try again.",
    P0002: "That profile or request could not be found.",
  };
  if (code === "bad_oauth_state" || code === "oauth_callback_error") return "Google sign-in could not be completed. Try again.";
  if (messages[code]) return messages[code];
  const lowered = message.toLowerCase();
  if (lowered.includes("rate limit") || lowered.includes("too many emails") || lowered.includes("over_email_send_rate_limit")) return "Too many emails were sent. Wait a few minutes or set up a custom SMTP provider in Supabase.";
  if (lowered.includes("access_denied") || lowered.includes("denied")) return "Google sign-in was cancelled. Try again.";
  if (lowered.includes("username") && lowered.includes("taken")) return "That username is already taken.";
  if (message) return message;
  return "Something went wrong. Please try again.";
}
