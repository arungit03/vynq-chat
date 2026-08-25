import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp as rtdbServerTimestamp,
  set,
} from "firebase/database";
import { db, functions, rtdb } from "@/lib/firebase/client";
import type { ChatMediaKind, ChatMessage, ConversationMeta, MediaUploadTicket, PresenceState } from "@/lib/chat/types";

const MESSAGE_LIFETIME_MS = 24 * 60 * 60 * 1000;

function messageFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): ChatMessage {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    senderUid: String(data.senderUid ?? ""),
    type: data.type === "image" || data.type === "video" ? data.type : "text",
    text: typeof data.text === "string" ? data.text : null,
    storagePath: typeof data.storagePath === "string" ? data.storagePath : null,
    contentType: typeof data.contentType === "string" ? data.contentType : null,
    bytes: typeof data.bytes === "number" ? data.bytes : null,
    durationSeconds: typeof data.durationSeconds === "number" ? data.durationSeconds : null,
    createdAt: data.createdAt ?? null,
    expiresAt: data.expiresAt ?? null,
    readAt: data.readAt ?? null,
  };
}

function conversationMetaFromData(id: string, data: DocumentData): ConversationMeta {
  return {
    id,
    memberUids: Array.isArray(data.memberUids) ? data.memberUids.filter((uid): uid is string => typeof uid === "string") : [],
    status: data.status === "closed" ? "closed" : "active",
    lastMessageAt: data.lastMessageAt ?? null,
    lastMessagePreview: typeof data.lastMessagePreview === "string" ? data.lastMessagePreview : null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function listenToMessages(conversationId: string, onMessages: (messages: ChatMessage[]) => void, onError: (error: Error) => void) {
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const messagesQuery = query(
    messagesRef,
    where("expiresAt", ">", Timestamp.fromMillis(Date.now())),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => onMessages(snapshot.docs.map(messageFromSnapshot)),
    onError,
  );
}

export function listenToConversationMeta(conversationId: string, onMeta: (meta: ConversationMeta | null) => void, onError: (error: Error) => void) {
  return onSnapshot(
    doc(db, "conversations", conversationId),
    (snapshot) => onMeta(snapshot.exists() ? conversationMetaFromData(snapshot.id, snapshot.data()) : null),
    onError,
  );
}

export async function sendTextMessage(conversationId: string, text: string) {
  const callable = httpsCallable<{ conversationId: string; text: string }, { messageId: string }>(functions, "sendMessage");
  return callable({ conversationId, text: text.trim() });
}

export async function createMediaUpload(conversationId: string, media: { kind: ChatMediaKind; contentType: string; bytes: number; durationSeconds: number | null }) {
  const callable = httpsCallable<
    { conversationId: string; type: ChatMediaKind; contentType: string; bytes: number; durationSeconds: number | null },
    MediaUploadTicket
  >(functions, "createMediaUpload");
  const result = await callable({ conversationId, type: media.kind, contentType: media.contentType, bytes: media.bytes, durationSeconds: media.durationSeconds });
  return result.data;
}

export async function finalizeMediaUpload(conversationId: string, messageId: string) {
  const callable = httpsCallable<{ conversationId: string; messageId: string }, { messageId: string }>(functions, "finalizeMediaUpload");
  const result = await callable({ conversationId, messageId });
  return result.data;
}

export async function abortMediaUpload(conversationId: string, messageId: string) {
  const callable = httpsCallable<{ conversationId: string; messageId: string }, { cancelled: true }>(functions, "abortMediaUpload");
  const result = await callable({ conversationId, messageId });
  return result.data;
}

export async function markMessageRead(conversationId: string, messageId: string) {
  await updateDoc(doc(db, "conversations", conversationId, "messages", messageId), {
    readAt: serverTimestamp(),
  });
}

export function listenToPresence(uid: string, onPresence: (presence: PresenceState | null) => void, onError: (error: Error) => void) {
  return onValue(
    ref(rtdb, `presence/${uid}`),
    (snapshot) => {
      const data = snapshot.val();
      if (!data || (data.state !== "online" && data.state !== "offline")) {
        onPresence(null);
        return;
      }
      onPresence({ state: data.state, lastChanged: typeof data.lastChanged === "number" ? data.lastChanged : undefined });
    },
    onError,
  );
}

export function listenToTyping(conversationId: string, uid: string, onTyping: (typing: boolean) => void, onError: (error: Error) => void) {
  return onValue(
    ref(rtdb, `typing/${conversationId}/${uid}`),
    (snapshot) => {
      const data = snapshot.val();
      const updatedAt = typeof data?.updatedAt === "number" ? data.updatedAt : Date.now();
      onTyping(Boolean(data?.isTyping) && Date.now() - updatedAt < 5000);
    },
    onError,
  );
}

export function startPresence(uid: string) {
  const connectionRef = ref(rtdb, ".info/connected");
  const presenceRef = ref(rtdb, `presence/${uid}`);
  const unsubscribe = onValue(connectionRef, (snapshot) => {
    if (snapshot.val() !== true) return;
    void onDisconnect(presenceRef).set({ state: "offline", lastChanged: rtdbServerTimestamp() }).then(() => {
      void set(presenceRef, { state: "online", lastChanged: rtdbServerTimestamp() });
    });
  });

  return () => {
    unsubscribe();
    void set(presenceRef, { state: "offline", lastChanged: rtdbServerTimestamp() });
  };
}

export async function setTyping(conversationId: string, uid: string, isTyping: boolean) {
  const typingRef = ref(rtdb, `typing/${conversationId}/${uid}`);
  if (!isTyping) return remove(typingRef);
  await onDisconnect(typingRef).remove();
  return set(typingRef, {
    isTyping,
    updatedAt: rtdbServerTimestamp(),
  });
}

export function formatChatTime(timestamp: Timestamp | null) {
  if (!timestamp) return "Sending…";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp.toDate());
}

export function formatLastSeen(timestamp?: number) {
  if (!timestamp) return "Offline";
  const age = Date.now() - timestamp;
  if (age < 90_000) return "Active recently";
  if (age < 60 * 60 * 1000) return `Last seen ${Math.max(1, Math.round(age / 60_000))}m ago`;
  return `Last seen ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp))}`;
}

export { MESSAGE_LIFETIME_MS };
