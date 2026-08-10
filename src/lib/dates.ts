/**
 * Date/time utilities centralized so every piece of the app derives expiry
 * and display from the same helpers. Firebase server timestamps are handled
 * here; never trust raw client Date.now() for security-sensitive times.
 */
import {
  serverTimestamp,
  type FieldValue,
  type Timestamp,
} from 'firebase/firestore'

export type ServerTimestamp = FieldValue | Timestamp | Date | number | null | undefined

/** Convert any Firestore timestamp shape to epoch milliseconds. */
export function toMillis(value: ServerTimestamp): number {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis()
  }
  const ts = value as { seconds?: number; nanoseconds?: number }
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1_000_000)
  }
  return 0
}

/** True when a Firestore timestamp field has already elapsed. */
export function isExpired(value: ServerTimestamp, now: number = Date.now()): boolean {
  const millis = toMillis(value)
  return millis > 0 && millis <= now
}

/** Compute a client-side expiration timestamp for a server-created record. */
export function expiresAtMillis(ttlMs: number, now: number = Date.now()): number {
  return now + ttlMs
}

/** Compare two timestamp-ish values (newest first). */
export function compareDesc(a: ServerTimestamp, b: ServerTimestamp): number {
  return toMillis(b) - toMillis(a)
}

// ── Formatting ───────────────────────────────────────────────

export function formatTime(value: ServerTimestamp): string {
  const millis = toMillis(value)
  if (!millis) return ''
  return new Date(millis).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDate(value: ServerTimestamp): string {
  const millis = toMillis(value)
  if (!millis) return ''
  return new Date(millis).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Today", "Yesterday", weekday, or a full date. */
export function formatDayLabel(value: ServerTimestamp, now: number = Date.now()): string {
  const millis = toMillis(value)
  if (!millis) return ''
  const date = new Date(millis)
  const today = new Date(now)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfDay) / 86_400_000)
  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'long' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Compact relative label used by the conversation list ("now", "3h", "2d"). */
export function formatRelativeShort(value: ServerTimestamp, now: number = Date.now()): string {
  const millis = toMillis(value)
  if (!millis) return ''
  const diff = now - millis
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(millis).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** "Expires in 4 days" — used in optional message details. */
export function formatExpiry(value: ServerTimestamp, now: number = Date.now()): string {
  const millis = toMillis(value)
  if (!millis) return ''
  const diff = millis - now
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / 86_400_000)
  if (days > 0) return `Expires in ${days} day${days === 1 ? '' : 's'}`
  const hours = Math.floor(diff / 3_600_000)
  if (hours > 0) return `Expires in ${hours}h`
  const minutes = Math.floor(diff / 60_000)
  if (minutes > 0) return `Expires in ${minutes}m`
  return 'Expires soon'
}

/** Firebase server timestamp sentinel for writes. */
export function serverNow(): FieldValue {
  return serverTimestamp()
}
