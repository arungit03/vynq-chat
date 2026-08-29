// Central domain types for Vynq-chat.

export type RequestStatus = "pending" | "accepted" | "rejected" | "blocked";

export type WhoCanRequest = "everyone" | "no_one";

export interface PrivacySettings {
  /** Who can send friend requests. */
  whoCanRequest: WhoCanRequest;
  /** Show online presence to friends. */
  showOnline: boolean;
  /** Show last-seen time to friends. */
  showLastSeen: boolean;
  /** Send read receipts. */
  readReceipts: boolean;
  /** Who can see my status. */
  statusVisibility: "friends" | "no_one";
  /** In-app message notifications. */
  notifyMessages: boolean;
  /** In-app friend-request notifications. */
  notifyFriendRequests: boolean;
  /** In-app status notifications. */
  notifyStatus: boolean;
}

export interface UserProfile {
  uid: string;
  username: string;
  usernameLower: string;
  email: string;
  displayName: string;
  bio: string;
  photoURL: string;
  createdAt: number;
  lastSeen: number;
  isOnline: boolean;
  emailVerified: boolean;
  statusEnabled: boolean;
  privacy: PrivacySettings;
  // Denormalized friend count for cheap display.
  friendsCount: number;
  // Rate-limit / abuse bookkeeping (server-authoritative values).
  followersCount: number;
  followingCount: number;
}

export type FriendRequestDirection = "incoming" | "outgoing";

export interface FriendRequest {
  id: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderPhotoURL: string;
  receiverId: string;
  receiverUsername: string;
  status: RequestStatus;
  createdAt: number;
}

export interface Friendship {
  id: string;
  userIds: [string, string];
  userA: string;
  userB: string;
  createdAt: number;
}

export type MessageType = "text" | "image" | "video";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text: string;
  // Media
  mediaURL?: string;
  mediaStoragePath?: string;
  mediaContentType?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDurationSec?: number;
  createdAt: number;
  expiresAt: number;
  status: MessageStatus;
  // Soft read tracking (who has read it) — kept small.
  readBy: string[];
}

export interface Chat {
  id: string;
  participants: string[];
  participantsUsernames: Record<string, string>;
  createdAt: number;
  lastMessageAt: number;
  lastMessage: string;
  lastMessageType: MessageType;
  lastSenderId: string;
  // Unread counts per participant (kept small: only 2 entries).
  unread: Record<string, number>;
  // Typing presence: uid -> serverTimestamp (or null when stopped). Throttled.
  typing?: Record<string, unknown>;
}

export type StatusType = "image" | "video";

export interface Status {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  ownerPhotoURL: string;
  type: StatusType;
  mediaURL: string;
  mediaStoragePath: string;
  mediaContentType: string;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDurationSec?: number;
  text?: string;
  createdAt: number;
  expiresAt: number;
  // Users who have viewed; kept bounded by cleanup.
  viewedBy: string[];
}

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "message"
  | "status";

export interface AppNotification {
  id: string;
  ownerId: string;
  type: NotificationType;
  fromUserId?: string;
  fromUsername?: string;
  fromDisplayName?: string;
  fromPhotoURL?: string;
  preview?: string;
  chatId?: string;
  statusId?: string;
  createdAt: number;
  read: boolean;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}
