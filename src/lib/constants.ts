// Centralized product constants. Server-side cleanup mirrors these exact values.

export const RETENTION = {
  /** Messages auto-delete 7 days after creation. */
  MESSAGE_DAYS: 7,
  /** Status auto-deletes 24 hours after creation. */
  STATUS_HOURS: 24,
} as const;

export const LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 20,
  DISPLAY_NAME_MAX: 40,
  BIO_MAX: 160,
  PASSWORD_MIN: 8,
  MESSAGE_TEXT_MAX: 4000,
  // Media
  IMAGE_MAX_MB: 10,
  VIDEO_MAX_MB: 30,
  STATUS_VIDEO_MAX_SECONDS: 30,
  STATUS_IMAGE_MAX_MB: 10,
  STATUS_VIDEO_MAX_MB: 30,
  // Anti-abuse (client hints; server enforces)
  REQUESTS_PER_HOUR: 30,
  MESSAGES_PER_MINUTE: 60,
} as const;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const STATUS_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const STATUS_ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/** Server timestamp offset is applied server-side; these are client-side defaults. */
export const MESSAGE_DEFAULT_TTL_MS = RETENTION.MESSAGE_DAYS * 24 * 60 * 60 * 1000;
export const STATUS_DEFAULT_TTL_MS = RETENTION.STATUS_HOURS * 60 * 60 * 1000;

export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
