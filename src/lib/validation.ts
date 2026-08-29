import { LIMITS, USERNAME_REGEX } from "./constants";

export interface UsernameValidation {
  ok: boolean;
  error?: string;
}

export function validateUsername(raw: string): UsernameValidation {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Username is required." };
  if (value.length < LIMITS.USERNAME_MIN) {
    return { ok: false, error: `Username must be at least ${LIMITS.USERNAME_MIN} characters.` };
  }
  if (value.length > LIMITS.USERNAME_MAX) {
    return { ok: false, error: `Username must be ${LIMITS.USERNAME_MAX} characters or fewer.` };
  }
  if (!USERNAME_REGEX.test(value)) {
    return { ok: false, error: "Use letters, numbers, and underscores only." };
  }
  return { ok: true };
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(email: string): UsernameValidation {
  const value = email.trim();
  if (!value) return { ok: false, error: "Email is required." };
  // Simple, pragmatic email check.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true };
}

export function validatePassword(pw: string): UsernameValidation {
  if (!pw) return { ok: false, error: "Password is required." };
  if (pw.length < LIMITS.PASSWORD_MIN) {
    return { ok: false, error: `Password must be at least ${LIMITS.PASSWORD_MIN} characters.` };
  }
  return { ok: true };
}

export function validateDisplayName(name: string): UsernameValidation {
  const value = name.trim();
  if (value.length > LIMITS.DISPLAY_NAME_MAX) {
    return { ok: false, error: `Display name must be ${LIMITS.DISPLAY_NAME_MAX} characters or fewer.` };
  }
  return { ok: true };
}

export function validateBio(bio: string): UsernameValidation {
  if (bio.length > LIMITS.BIO_MAX) {
    return { ok: false, error: `Bio must be ${LIMITS.BIO_MAX} characters or fewer.` };
  }
  return { ok: true };
}
