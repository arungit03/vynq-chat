/**
 * Frontend + shared validation rules. These provide friendly UX feedback and
 * normalize input, but NEVER replace server/security-rule enforcement.
 */
import {
  RESERVED_USERNAMES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from './constants'

export const normalizeUsername = (value: string): string =>
  value.trim().toLowerCase().replace(/\.+$/, '')

export type UsernameValidation =
  | { ok: true; normalized: string }
  | { ok: false; reason: string }

export function validateUsername(raw: string): UsernameValidation {
  const value = raw.trim()
  if (value.length === 0) return { ok: false, reason: 'Username is required' }
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters`,
    }
  }
  if (!USERNAME_PATTERN.test(value)) {
    return {
      ok: false,
      reason: 'Use letters, numbers, underscore or period. No spaces.',
    }
  }
  const normalized = normalizeUsername(value)
  if (RESERVED_USERNAMES.has(normalized)) {
    return { ok: false, reason: 'That username is reserved' }
  }
  return { ok: true, normalized }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type EmailValidation = { ok: true } | { ok: false; reason: string }

export function validateEmail(raw: string): EmailValidation {
  const value = raw.trim()
  if (value.length === 0) return { ok: false, reason: 'Email is required' }
  if (!EMAIL_PATTERN.test(value)) return { ok: false, reason: 'Enter a valid email address' }
  return { ok: true }
}

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

export type PasswordValidation = { ok: true } | { ok: false; reason: string }

export function validatePassword(raw: string): PasswordValidation {
  if (raw.length === 0) return { ok: false, reason: 'Password is required' }
  if (raw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `At least ${MIN_PASSWORD_LENGTH} characters` }
  }
  if (raw.length > MAX_PASSWORD_LENGTH) return { ok: false, reason: 'Password is too long' }
  return { ok: true }
}

/** 0–3 score for the strength indicator. */
export function passwordStrength(raw: string): number {
  let score = 0
  if (raw.length >= MIN_PASSWORD_LENGTH) score += 1
  if (/[a-z]/.test(raw) && /[A-Z]/.test(raw)) score += 1
  if (/\d/.test(raw)) score += 1
  if (/[^a-zA-Z0-9]/.test(raw)) score += 1
  return score
}

export function passwordStrengthLabel(score: number): string {
  if (score <= 1) return 'Weak'
  if (score === 2) return 'Fair'
  if (score === 3) return 'Good'
  return 'Strong'
}
