/**
 * Vynq-chat Cloud Functions
 * -------------------------
 * Server-side authority for: automatic expiry of messages & statuses (and their
 * Storage media), friend-request acceptance (creates mutual friendship + notifies),
 * and anti-abuse rate hints.
 *
 * Cleanup is idempotent: re-runs safely skip already-deleted records.
 * Only metadata is processed; message text is never logged.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 2 });

const db = getFirestore();
const storage = getStorage();

const MESSAGE_TTL_DAYS = 7;
const STATUS_TTL_HOURS = 24;
const BATCH_LIMIT = 300;

/** Safely delete a Storage object (ignore missing). */
async function safeDeleteStorage(path: string | undefined) {
  if (!path) return;
  try {
    await storage.bucket().file(path).delete();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== "storage/object-not-found") {
      console.warn(`Cleanup: failed to delete storage ${path}:`, code);
    }
  }
}

/** Delete all media under a chat message path. */
async function deleteMessageMedia(chatId: string, messageId: string, storagePath?: string) {
  if (storagePath) {
    await safeDeleteStorage(storagePath);
    return;
  }
  try {
    const [files] = await storage.bucket().getFiles({ prefix: `chatMedia/${chatId}/${messageId}/` });
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
  } catch {
    // ignore
  }
}

/** Expire messages older than 7 days, delete Firestore doc + media. */
export const cleanupExpiredMessages = onSchedule(
  { schedule: "every 60 minutes", timeoutSeconds: 540 },
  async () => {
    const cutoff = Date.now() - MESSAGE_TTL_DAYS * 24 * 60 * 60 * 1000;
    let totalDeleted = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    // Paginate chats (we must read messages within each chat).
    const chatsSnap = await db.collection("chats").limit(BATCH_LIMIT).get();
    for (const chat of chatsSnap.docs) {
      let query = chat.ref
        .collection("messages")
        .where("expiresAt", "<=", cutoff)
        .limit(BATCH_LIMIT);
      // cursor pagination within a chat
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const msgs = await query.get();
        if (msgs.empty) break;
        const batch = db.batch();
        for (const m of msgs.docs) {
          const data = m.data() as { chatId?: string; mediaStoragePath?: string };
          batch.delete(m.ref);
          await deleteMessageMedia(chat.id, m.id, data.mediaStoragePath);
        }
        await batch.commit();
        totalDeleted += msgs.size;
        if (msgs.size < BATCH_LIMIT) break;
        lastDoc = msgs.docs[msgs.docs.length - 1] as FirebaseFirestore.QueryDocumentSnapshot;
        query = chat.ref
          .collection("messages")
          .where("expiresAt", "<=", cutoff)
          .startAfter(lastDoc)
          .limit(BATCH_LIMIT);
      }
    }
    console.log(`[cleanup] deleted ${totalDeleted} expired messages`);
  },
);

/** Expire statuses older than 24h, delete doc + media. */
export const cleanupExpiredStatuses = onSchedule(
  { schedule: "every 30 minutes", timeoutSeconds: 540 },
  async () => {
    const cutoff = Date.now() - STATUS_TTL_HOURS * 60 * 60 * 1000;
    let deleted = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const snap = await db
        .collection("statuses")
        .where("expiresAt", "<=", cutoff)
        .limit(BATCH_LIMIT)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const s of snap.docs) {
        const data = s.data() as { mediaStoragePath?: string };
        batch.delete(s.ref);
        await safeDeleteStorage(data.mediaStoragePath);
      }
      await batch.commit();
      deleted += snap.size;
      if (snap.size < BATCH_LIMIT) break;
    }
    console.log(`[cleanup] deleted ${deleted} expired statuses`);
  },
);

/** When a friend request is accepted, create the mutual friendship + notify. */
export const onFriendRequestAccepted = onDocumentUpdated(
  {
    document: "friendRequests/{reqId}",
    timeoutSeconds: 60,
  },
  async (event) => {
    const before = event.data?.before.data() as { status?: string } | undefined;
    const after = event.data?.after.data() as
      | { status?: string; senderId?: string; receiverId?: string; senderUsername?: string; receiverUsername?: string }
      | undefined;
    // Only act on the accepted transition.
    if (!after || after.status !== "accepted") return;
    if (before && before.status === "accepted") return;

    const senderId = after.senderId!;
    const receiverId = after.receiverId!;
    const fid = [senderId, receiverId].sort().join("_");
    const friendshipRef = db.collection("friendships").doc(fid);
    const existingFriendship = await friendshipRef.get();
    // The web client may complete the accepted-request transaction itself
    // when Functions are unavailable. Do not increment counts twice if this
    // trigger later observes that already-created friendship.
    if (existingFriendship.exists) return;

    const batch = db.batch();
    batch.set(friendshipRef, {
      id: fid,
      userIds: [senderId, receiverId],
      userA: senderId,
      userB: receiverId,
      createdAt: Date.now(),
    });
    batch.update(db.collection("users").doc(senderId), { friendsCount: FieldValue.increment(1) });
    batch.update(db.collection("users").doc(receiverId), { friendsCount: FieldValue.increment(1) });

    // Notify sender
    const notifRef = db
      .collection("users")
      .doc(senderId)
      .collection("notifications")
      .doc();
    batch.set(notifRef, {
      id: notifRef.id,
      ownerId: senderId,
      type: "friend_accepted",
      fromUserId: receiverId,
      fromUsername: after.receiverUsername,
      preview: `${after.receiverUsername} accepted your friend request`,
      createdAt: Date.now(),
      read: false,
    });
    await batch.commit();
  },
);

/** Notify the receiver when a friend request arrives (in-app only). */
export const onFriendRequestCreated = onDocumentCreated(
  {
    document: "friendRequests/{reqId}",
    timeoutSeconds: 60,
  },
  async (event) => {
    const data = event.data?.data() as
      | { senderId?: string; receiverId?: string; senderUsername?: string }
      | undefined;
    if (!data || !data.senderId || !data.receiverId || data.senderId === data.receiverId) return;

    const notifRef = db
      .collection("users")
      .doc(data.receiverId)
      .collection("notifications")
      .doc();
    await notifRef.set({
      id: notifRef.id,
      ownerId: data.receiverId,
      type: "friend_request",
      fromUserId: data.senderId,
      fromUsername: data.senderUsername,
      preview: `${data.senderUsername} sent you a friend request`,
      requestId: event.params.reqId,
      createdAt: Date.now(),
      read: false,
    });
  },
);

/** Notify the receiver when a new message arrives (in-app only). */
export const onMessageCreated = onDocumentCreated(
  {
    document: "chats/{chatId}/messages/{msgId}",
    timeoutSeconds: 60,
  },
  async (event) => {
    const data = event.data?.data() as
      | { senderId?: string; text?: string; type?: string; chatId?: string }
      | undefined;
    if (!data || !data.senderId) return;
    const chatSnap = await db.collection("chats").doc(data.chatId!).get();
    const chat = chatSnap.data() as { participants?: string[] } | undefined;
    if (!chat?.participants) return;
    const receiverId = chat.participants.find((p) => p !== data.senderId);
    if (!receiverId) return;

    const preview =
      data.type === "image" ? "📷 Photo" : data.type === "video" ? "🎥 Video" : (data.text ?? "").slice(0, 80);
    const notifRef = db
      .collection("users")
      .doc(receiverId)
      .collection("notifications")
      .doc();
    await notifRef.set({
      id: notifRef.id,
      ownerId: receiverId,
      type: "message",
      fromUserId: data.senderId,
      preview,
      chatId: data.chatId,
      createdAt: Date.now(),
      read: false,
    });
  },
);

/**
 * Server-authoritative account deletion. The client cannot delete its own
 * Firestore documents because the security rules forbid deletion (never trust
 * the client). This callable runs with admin privileges and removes the user's
 * profile, friend requests, friendships (and decrements peers' counts),
 * statuses, conversations + messages, notifications, and Storage objects —
 * then deletes the Firebase Auth user. Only the authenticated owner may invoke.
 */
export const deleteAccount = onCall({ timeoutSeconds: 300 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

  // Friend requests involving the user.
  const reqOut = await db.collection("friendRequests").where("senderId", "==", uid).get();
  const reqIn = await db.collection("friendRequests").where("receiverId", "==", uid).get();

  // Friendships involving the user -> peers for count decrement.
  const fq = await db.collection("friendships").where("userIds", "array-contains", uid).get();
  const peerIds = new Set<string>();
  fq.docs.forEach((d) => {
    (d.data().userIds as string[]).forEach((id) => id !== uid && peerIds.add(id));
  });

  const myStatuses = await db.collection("statuses").where("ownerId", "==", uid).get();
  const myChats = await db.collection("chats").where("participants", "array-contains", uid).get();
  const myNotifs = await db.collection("users").doc(uid).collection("notifications").get();

  let batch = db.batch();
  let ops = 0;
  const add = (ref: FirebaseFirestore.DocumentReference) => {
    batch.delete(ref);
    if (++ops >= 400) void flush();
  };
  const flush = () => {
    if (ops === 0) return Promise.resolve();
    const p = batch.commit();
    ops = 0;
    batch = db.batch(); // a committed WriteBatch cannot be reused
    return p;
  };

  reqOut.docs.forEach((d) => add(d.ref));
  reqIn.docs.forEach((d) => add(d.ref));
  fq.docs.forEach((d) => add(d.ref));
  myStatuses.docs.forEach((d) => add(d.ref));
  myNotifs.docs.forEach((d) => add(d.ref));
  peerIds.forEach((pid) => {
    batch.update(db.collection("users").doc(pid), { friendsCount: FieldValue.increment(-1) });
    if (++ops >= 400) void flush();
  });
  for (const c of myChats.docs) {
    const msgs = await c.ref.collection("messages").get();
    msgs.docs.forEach((m) => add(m.ref));
    add(c.ref);
  }
  add(db.collection("users").doc(uid));
  await flush();

  // Best-effort Storage cleanup.
  const prefixes = [`profilePictures/${uid}`, `statusMedia/${uid}`];
  for (const c of myChats.docs) prefixes.push(`chatMedia/${c.id}`);
  await Promise.all(
    prefixes.map(async (prefix) => {
      try {
        const [files] = await storage.bucket().getFiles({ prefix });
        await Promise.all(files.map((f) => f.delete().catch(() => {})));
      } catch {
        // ignore missing paths
      }
    }),
  );

  // Finally delete the auth user.
  await getAuth().deleteUser(uid);
  return { deleted: true };
});
