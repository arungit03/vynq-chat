/**
 * App-wide constants: retention policies, validation rules, and limits.
 *
 * All time-based policies are expressed in milliseconds. These values drive
 * message/status expiry (UI filtering, cleanup function, and Firestore TTL).
 */

// ── Retention policies ───────────────────────────────────────
/** Chat messages automatically disappear 7 days after being sent. */
export const MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Status updates automatically disappear 24 hours after being posted. */
export const STATUS_TTL_MS = 24 * 60 * 60 * 1000
/** Typing indicators self-expire after this window. */
export const TYPING_TTL_MS = 5_000
/** Preview (ephemeral last message) expiry buffer past its source message. */
export const PREVIEW_TTL_BUFFER_MS = 60 * 1000
/** Clock used by the client to drop expired content without backend help. */
export const CLIENT_EXPIRY_TICK_MS = 30_000
/** How long to keep showing "you are typing" once writing stops. */
export const TYPING_DISPLAY_MS = 3_000
/** Throttle for typing indicator writes. */
export const TYPING_WRITE_THROTTLE_MS = 2_000

// ── Username ─────────────────────────────────────────────────
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,20}$/
export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'a3chat',
  'support',
  'help',
  'moderator',
  'system',
  'root',
  'a3',
  'api',
  'firebase',
  'status',
  'settings',
  'login',
  'register',
  'search',
  'profile',
  'home',
  'notification',
])

// ── Profile ──────────────────────────────────────────────────
export const DISPLAY_NAME_MAX_LENGTH = 40
export const BIO_MAX_LENGTH = 180
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5 MB

// ── Media limits ─────────────────────────────────────────────
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_CHAT_VIDEO_SIZE = 60 * 1024 * 1024 // 60 MB
export const MAX_CHAT_VIDEO_DURATION_S = 60
export const MAX_STATUS_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_STATUS_VIDEO_SIZE = 60 * 1024 * 1024 // 60 MB
export const MAX_STATUS_VIDEO_DURATION_S = 30 // 30-second rule
/** How long an image status stays on screen in the viewer (videos use their own length). */
export const STATUS_IMAGE_DURATION_MS = 5_000

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

// ── Messaging ────────────────────────────────────────────────
export const INITIAL_MESSAGE_LIMIT = 30
export const OLDER_MESSAGE_LIMIT = 30
export const MAX_MESSAGE_TEXT_LENGTH = 4000
export const TEXT_EDIT_WINDOW_MS = 15 * 60 * 1000 // allow edit for 15 minutes
export const MAX_REPLY_PREVIEW_LENGTH = 80
export const SEARCH_RESULT_LIMIT = 8
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

// ── Conversations / presence ─────────────────────────────────
export const LAST_SEEN_VISIBILITY_OPTIONS = ['everyone', 'connections', 'nobody'] as const
export type LastSeenVisibility = (typeof LAST_SEEN_VISIBILITY_OPTIONS)[number]

export const STATUS_VISIBILITY_OPTIONS = ['connections', 'nobody'] as const
export type StatusVisibility = (typeof STATUS_VISIBILITY_OPTIONS)[number]

// ── Storage paths ────────────────────────────────────────────
export const CHAT_MEDIA_PREFIX = 'chatMedia'
export const STATUS_MEDIA_PREFIX = 'statusMedia'
export const AVATAR_PREFIX = 'avatars'

export function chatMediaPath(conversationId: string, messageId: string, filename: string): string {
  return `${CHAT_MEDIA_PREFIX}/${conversationId}/${messageId}/${filename}`
}
export function statusMediaPath(userId: string, statusId: string, filename: string): string {
  return `${STATUS_MEDIA_PREFIX}/${userId}/${statusId}/${filename}`
}
export function avatarPath(uid: string, filename: string): string {
  return `${AVATAR_PREFIX}/${uid}/${filename}`
}
