import type { Timestamp } from "firebase/firestore";

export type ChatMessageType = "text" | "image" | "video";

export type ChatMediaKind = Exclude<ChatMessageType, "text">;

export type MediaUploadTicket = {
  messageId: string;
  storagePath: string;
};

export type ChatMessage = {
  id: string;
  senderUid: string;
  type: ChatMessageType;
  text: string | null;
  storagePath: string | null;
  contentType: string | null;
  bytes: number | null;
  durationSeconds: number | null;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  readAt: Timestamp | null;
};

export type ConversationMeta = {
  id: string;
  memberUids: string[];
  status: "active" | "closed";
  lastMessageAt: Timestamp | null;
  lastMessagePreview: string | null;
  updatedAt: Timestamp | null;
};

export type PresenceState = {
  state: "online" | "offline";
  lastChanged?: number;
};
