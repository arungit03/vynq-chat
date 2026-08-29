import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit as qLimit, writeBatch,
  onSnapshot, serverTimestamp, type FirestoreDataConverter,
} from "firebase/firestore";
import { requireFirebase } from "@/lib/firebase/app";
import type { Chat, Message, MessageStatus, MessageType, UserProfile } from "@/lib/firebase/types";
import { MESSAGE_DEFAULT_TTL_MS, LIMITS } from "@/lib/constants";

const chatConverter: FirestoreDataConverter<Chat> = {
  toFirestore: (c) => ({ ...c }),
  fromFirestore: (s) => s.data() as Chat,
};
const msgConverter: FirestoreDataConverter<Message> = {
  toFirestore: (m) => ({ ...m }),
  fromFirestore: (s) => s.data() as Message,
};

/** Deterministic 1:1 chat id from two uids (sorted). Prevents duplicate chats. */
export function chatIdFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

export function chatDoc(id: string) {
  const { db } = requireFirebase();
  return doc(db, "chats", id).withConverter(chatConverter);
}
export function messagesCol(chatId: string) {
  const { db } = requireFirebase();
  return collection(db, "chats", chatId, "messages").withConverter(msgConverter);
}
export function messageDoc(chatId: string, msgId: string) {
  const { db } = requireFirebase();
  return doc(db, "chats", chatId, "messages", msgId).withConverter(msgConverter);
}

export async function getOrCreateChat(myProfile: UserProfile, other: UserProfile): Promise<Chat> {
  const id = chatIdFor(myProfile.uid, other.uid);
  const ref = chatDoc(id);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const chat: Chat = {
    id,
    participants: [myProfile.uid, other.uid],
    participantsUsernames: {
      [myProfile.uid]: myProfile.username,
      [other.uid]: other.username,
    },
    createdAt: Date.now(),
    lastMessageAt: Date.now(),
    lastMessage: "",
    lastMessageType: "text",
    lastSenderId: myProfile.uid,
    unread: { [myProfile.uid]: 0, [other.uid]: 0 },
  };
  await setDoc(ref, chat);
  return chat;
}

export async function getChat(id: string): Promise<Chat | null> {
  const snap = await getDoc(chatDoc(id));
  return snap.exists() ? snap.data() : null;
}

export async function getMyChats(myId: string, max = 50): Promise<Chat[]> {
  const { db } = requireFirebase();
  const q = query(
    collection(db, "chats").withConverter(chatConverter),
    where("participants", "array-contains", myId),
    orderBy("lastMessageAt", "desc"),
    qLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/** Send a text or media message. `media` fields optional (set by caller on upload). */
export async function sendMessage(params: {
  chat: Chat;
  sender: UserProfile;
  type: MessageType;
  messageId?: string;
  text?: string;
  media?: {
    url: string;
    storagePath: string;
    contentType: string;
    width?: number;
    height?: number;
    durationSec?: number;
  };
}): Promise<Message> {
  const { db } = requireFirebase();
  const { chat, sender, type } = params;
  const id = params.messageId ?? doc(collection(db, "chats", chat.id, "messages")).id;
  const now = Date.now();
  const otherId = chat.participants.find((p) => p !== sender.uid)!;
  const preview = type === "text" ? (params.text ?? "").slice(0, 80) : type === "image" ? "📷 Photo" : "🎥 Video";
  const msg: Message = {
    id,
    chatId: chat.id,
    senderId: sender.uid,
    type,
    text: params.text ?? "",
    createdAt: now,
    expiresAt: now + MESSAGE_DEFAULT_TTL_MS,
    status: "sent",
    readBy: [],
    // Firestore rejects undefined values by default. Keep optional media
    // fields out of text messages instead of writing them as undefined.
    ...(params.media
      ? {
          mediaURL: params.media.url,
          mediaStoragePath: params.media.storagePath,
          mediaContentType: params.media.contentType,
          ...(params.media.width !== undefined ? { mediaWidth: params.media.width } : {}),
          ...(params.media.height !== undefined ? { mediaHeight: params.media.height } : {}),
          ...(params.media.durationSec !== undefined ? { mediaDurationSec: params.media.durationSec } : {}),
        }
      : {}),
  };
  const batch = writeBatch(db);
  batch.set(messageDoc(chat.id, id), msg);
  const unread = { ...chat.unread, [otherId]: (chat.unread[otherId] ?? 0) + 1 };
  batch.update(chatDoc(chat.id), {
    lastMessageAt: now,
    lastMessage: preview,
    lastMessageType: type,
    lastSenderId: sender.uid,
    unread,
  });
  await batch.commit();
  return msg;
}

export async function markChatRead(chat: Chat, myId: string) {
  if ((chat.unread[myId] ?? 0) === 0) return;
  await updateDoc(chatDoc(chat.id), { [`unread.${myId}`]: 0 });
}

export async function markMessageRead(message: Message, myId: string) {
  if (message.senderId === myId) return;
  if (message.readBy.includes(myId)) return;
  if (!message.readBy.includes(myId)) {
    await updateDoc(messageDoc(message.chatId, message.id), { readBy: [...message.readBy, myId], status: "read" });
  }
}

export async function markMessageDelivered(message: Message, myId: string) {
  if (message.senderId === myId) return;
  if (message.status === "delivered" || message.status === "read") return;
  await updateDoc(messageDoc(message.chatId, message.id), { status: "delivered" });
}

export function subscribeToChat(
  chatId: string,
  cb: (messages: Message[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(messagesCol(chatId), orderBy("createdAt", "asc"), qLimit(200));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data()));
  }, onError);
}

export function subscribeToMyChats(myId: string, cb: (chats: Chat[]) => void) {
  const { db } = requireFirebase();
  const q = query(
    collection(db, "chats").withConverter(chatConverter),
    where("participants", "array-contains", myId),
    orderBy("lastMessageAt", "desc"),
    qLimit(60),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

/** Typing indicator: throttled writes, auto-clear via server timestamp + client timeout. */
export async function setTyping(chatId: string, myId: string, isTyping: boolean) {
  await updateDoc(chatDoc(chatId), { [`typing.${myId}`]: isTyping ? serverTimestamp() : null });
}

export type { MessageStatus };
export { LIMITS };
