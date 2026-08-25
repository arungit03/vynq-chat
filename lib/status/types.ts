import type { Timestamp } from "firebase/firestore";
import type { ChatMediaKind } from "@/lib/chat/types";

export type StoryStatus = {
  id: string;
  ownerUid: string;
  ownerDisplayName: string;
  ownerUsername: string;
  type: ChatMediaKind;
  storagePath: string;
  contentType: string;
  bytes: number;
  durationSeconds: number | null;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
};

export type StatusUploadTicket = {
  statusId: string;
  storagePath: string;
};
