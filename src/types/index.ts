/**
 * Central application types. Firebase server timestamps are represented as
 * Firestore `Timestamp`; convert for display with `lib/dates.ts`.
 */
import type { Timestamp } from 'firebase/firestore'
import type { LastSeenVisibility, StatusVisibility } from '@/lib/constants'
import type { ThemePreference } from '@/lib/theme'

/** A Firestore server timestamp as stored on documents. */
export type DocTs = Timestamp

// ── Identity ─────────────────────────────────────────────────

/** Private account document at users/{uid}. Functions write, owner reads. */
export interface User {
  uid: string
  email: string
  username: string
  normalizedUsername: string
  createdAt: DocTs
  updatedAt: DocTs
  emailVerified: boolean
}

/** Searchable social document at publicProfiles/{uid}. */
export interface PublicProfile {
  uid: string
  username: string
  normalizedUsername: string
  displayName?: string
  avatarPath?: string
  avatarURL?: string
  bio?: string
  createdAt: DocTs
}

/** Unique-username reservation at usernames/{normalizedUsername}. */
export interface UsernameReservation {
  uid: string
  createdAt: DocTs
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: FriendRequestStatus
  createdAt: DocTs
  updatedAt: DocTs
}

export interface Friendship {
  id: string
  members: string[]
  createdAt: DocTs
}

export type RelationshipState =
  | 'none'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'connected'
  | 'blocked'

export interface Block {
  blockerId: string
  blockedId: string
  createdAt: DocTs
}

// ── Conversations & messages ─────────────────────────────────

export type MessageType = 'text' | 'image' | 'video'

/** Local delivery state shown under outgoing bubbles. */
export type DeliveryState = 'sending' | 'sent' | 'seen'

/**
 * Short, expiring preview stored on the conversation document. Only a short
 * snippet is kept — never a full copy of the message (see privacy spec).
 */
export interface EphemeralMessage {
  messageId: string
  senderId: string
  type: MessageType
  preview: string
  createdAt: DocTs
  expiresAt: DocTs
}

export interface Conversation {
  id: string
  members: string[]
  createdAt: DocTs
  updatedAt?: DocTs
  lastActivityAt?: DocTs
  /** uid → timestamp of the member's last read activity. */
  lastRead?: Record<string, DocTs>
  ephemeralLastMessage?: EphemeralMessage
}

export interface ReplyRef {
  messageId: string
  senderId: string
  type: MessageType
  preview: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  type: MessageType
  text?: string
  caption?: string
  mediaPath?: string
  mediaType?: string
  mediaWidth?: number
  mediaHeight?: number
  mediaDuration?: number
  mediaSize?: number
  replyTo?: ReplyRef
  /** emoji → uid of the user who reacted (one reaction per user per emoji). */
  reactions?: Record<string, string>
  createdAt: DocTs
  expiresAt: DocTs
  editedAt?: DocTs
}

/** Ephemeral typing indicator doc at conversations/{id}/typing/{uid}. */
export interface TypingDoc {
  uid: string
  expiresAt: DocTs
}

// ── Status ───────────────────────────────────────────────────

export interface Status {
  id: string
  ownerId: string
  mediaPath: string
  mediaType: string
  mediaWidth?: number
  mediaHeight?: number
  mediaDuration?: number
  caption?: string
  createdAt: DocTs
  expiresAt: DocTs
}

export interface StatusView {
  viewerId: string
  viewedAt: DocTs
}

// ── Settings ─────────────────────────────────────────────────

export interface UserSettings {
  uid: string
  lastSeenVisibility: LastSeenVisibility
  readReceipts: boolean
  statusVisibility: StatusVisibility
  notifications: {
    messages: boolean
    requests: boolean
    status: boolean
  }
  theme?: ThemePreference
}

// ── Notifications (Firestore + FCM payload shapes) ───────────

export type AppNotificationType = 'message' | 'request' | 'accepted'

export interface NotificationRecord {
  id: string
  userId: string
  type: AppNotificationType
  actorId: string
  conversationId?: string
  read: boolean
  createdAt: DocTs
}

/** FCM payload — deliberately generic, never private message content. */
export interface FcmNotificationData {
  type: AppNotificationType
  actorId: string
  username: string
  conversationId?: string
}
