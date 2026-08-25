import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, onRequest, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

function firebaseAdminOptions() {
  const databaseUrl = process.env.FIREBASE_DATABASE_URL;
  if (!databaseUrl) return undefined;
  try {
    const runtimeConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) as Record<string, unknown> : {};
    return { ...runtimeConfig, databaseURL: databaseUrl };
  } catch {
    return { databaseURL: databaseUrl };
  }
}

const adminApp = getApps().length ? getApp() : initializeApp(firebaseAdminOptions());
const firestore = getFirestore(adminApp);
const storageBucket = getStorage(adminApp).bucket();

const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 30;
const MEDIA_UPLOAD_LIFETIME_MS = 15 * 60 * 1000;
const PRIVATE_CACHE_CONTROL = "private, max-age=0, no-store";
const callableOptions = {
  cors: true,
  // Keep this false until the web App Check provider has been registered and
  // observed in Firebase. It can then be enabled without a source change.
  enforceAppCheck: process.env.VYNQ_ENFORCE_APP_CHECK === "true",
};
const RATE_LIMITS = {
  usernameClaim: { maximum: 5, windowMs: 60 * 60 * 1000 },
  followRequest: { maximum: 20, windowMs: 60 * 60 * 1000 },
  followResponse: { maximum: 60, windowMs: 60 * 60 * 1000 },
  message: { maximum: 60, windowMs: 60 * 1000 },
  mediaUpload: { maximum: 12, windowMs: 10 * 60 * 1000 },
  mediaFinalize: { maximum: 24, windowMs: 10 * 60 * 1000 },
  statusUpload: { maximum: 24, windowMs: 60 * 60 * 1000 },
  statusFinalize: { maximum: 36, windowMs: 60 * 60 * 1000 },
} as const;

type MediaType = "image" | "video";
type RateLimitAction = keyof typeof RATE_LIMITS;

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function requireVerifiedUser(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth.token.email_verified !== true) throw new HttpsError("permission-denied", "Verify your email before managing connections.");
  return request.auth.uid;
}

function pairId(uidA: string, uidB: string) {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

function isMediaType(value: unknown): value is MediaType {
  return value === "image" || value === "video";
}

function allowedContentType(type: MediaType, contentType: unknown): contentType is string {
  return (type === "image" && (contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp"))
    || (type === "video" && (contentType === "video/mp4" || contentType === "video/webm"));
}

function mediaByteLimit(type: MediaType) {
  return type === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
}

function expectedMediaPath(conversationId: string, messageId: string) {
  return `conversations/${conversationId}/messages/${messageId}/media`;
}

function expectedStatusPath(statusId: string) {
  return `statuses/${statusId}/media`;
}

async function enforceRateLimit(uid: string, action: RateLimitAction) {
  const policy = RATE_LIMITS[action];
  const rateLimitRef = firestore.collection("rateLimits").doc(`${uid}_${action}`);
  const now = Date.now();
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const current = snapshot.data() ?? {};
    const startedAt = current.windowStartedAt instanceof Timestamp ? current.windowStartedAt.toMillis() : 0;
    const activeWindow = startedAt > 0 && now - startedAt < policy.windowMs;
    const count = activeWindow && typeof current.count === "number" ? current.count : 0;
    if (count >= policy.maximum) {
      throw new HttpsError("resource-exhausted", "Too many requests. Please wait before trying again.");
    }
    const windowStartedAt = activeWindow ? Timestamp.fromMillis(startedAt) : Timestamp.fromMillis(now);
    transaction.set(rateLimitRef, {
      uid,
      action,
      count: count + 1,
      windowStartedAt,
      cleanupAt: Timestamp.fromMillis(windowStartedAt.toMillis() + policy.windowMs),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function grantRealtimeConversationAccess(conversationId: string, uidA: string, uidB: string) {
  if (!adminApp.options.databaseURL) {
    throw new Error("FIREBASE_DATABASE_URL is required to synchronize private realtime access.");
  }
  await getDatabase(adminApp).ref().update({
    [`conversationMembers/${conversationId}/${uidA}`]: true,
    [`conversationMembers/${conversationId}/${uidB}`]: true,
    [`presenceAudience/${uidA}/${uidB}`]: true,
    [`presenceAudience/${uidB}/${uidA}`]: true,
  });
}

function assertUploadRequest(data: { conversationId?: unknown; type?: unknown; contentType?: unknown; bytes?: unknown; durationSeconds?: unknown }) {
  if (typeof data.conversationId !== "string" || !data.conversationId.trim()) {
    throw new HttpsError("invalid-argument", "A conversation is required.");
  }
  if (!isMediaType(data.type) || !allowedContentType(data.type, data.contentType)) {
    throw new HttpsError("invalid-argument", "Choose a supported image, MP4, or WebM file.");
  }
  if (typeof data.bytes !== "number" || !Number.isSafeInteger(data.bytes) || data.bytes <= 0 || data.bytes > mediaByteLimit(data.type)) {
    throw new HttpsError("invalid-argument", "That media file is outside the allowed size limit.");
  }
  if (data.type === "video" && (typeof data.durationSeconds !== "number" || !Number.isFinite(data.durationSeconds) || data.durationSeconds <= 0 || data.durationSeconds > MAX_VIDEO_DURATION_SECONDS)) {
    throw new HttpsError("invalid-argument", "Videos can be up to 30 seconds long.");
  }
  return {
    conversationId: data.conversationId.trim(),
    type: data.type,
    contentType: data.contentType,
    bytes: data.bytes,
  };
}

function assertStatusUploadRequest(data: { type?: unknown; contentType?: unknown; bytes?: unknown; durationSeconds?: unknown }) {
  if (!isMediaType(data.type) || !allowedContentType(data.type, data.contentType)) {
    throw new HttpsError("invalid-argument", "Choose a supported image, MP4, or WebM file.");
  }
  if (typeof data.bytes !== "number" || !Number.isSafeInteger(data.bytes) || data.bytes <= 0 || data.bytes > mediaByteLimit(data.type)) {
    throw new HttpsError("invalid-argument", "That media file is outside the allowed size limit.");
  }
  if (data.type === "video" && (typeof data.durationSeconds !== "number" || !Number.isFinite(data.durationSeconds) || data.durationSeconds <= 0 || data.durationSeconds > MAX_VIDEO_DURATION_SECONDS)) {
    throw new HttpsError("invalid-argument", "Videos can be up to 30 seconds long.");
  }
  return {
    type: data.type,
    contentType: data.contentType,
    bytes: data.bytes,
  };
}

async function assertActiveConversation(conversationId: string, uid: string) {
  const conversationRef = firestore.collection("conversations").doc(conversationId);
  const conversationSnapshot = await conversationRef.get();
  if (!conversationSnapshot.exists) throw new HttpsError("not-found", "That conversation does not exist.");
  const conversation = conversationSnapshot.data() ?? {};
  const memberUids = Array.isArray(conversation.memberUids) ? conversation.memberUids : [];
  if (!memberUids.includes(uid) || conversation.status !== "active") {
    throw new HttpsError("permission-denied", "You are not a member of this conversation.");
  }
  return conversationRef;
}

function indexOfSequence(buffer: Buffer, sequence: number[], start = 0) {
  outer: for (let index = start; index <= buffer.length - sequence.length; index += 1) {
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (buffer[index + offset] !== sequence[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function readEbmlVint(buffer: Buffer, offset: number) {
  const first = buffer[offset];
  if (first === undefined) return null;
  let length = 1;
  let marker = 0x80;
  while (length <= 8 && (first & marker) === 0) {
    length += 1;
    marker >>= 1;
  }
  if (length > 8 || offset + length > buffer.length) return null;
  let value = first & (marker - 1);
  for (let index = 1; index < length; index += 1) value = value * 256 + buffer[offset + index];
  return { length, value };
}

function readUnsigned(buffer: Buffer, offset: number, length: number) {
  if (length < 1 || length > 6 || offset + length > buffer.length) return null;
  let value = 0;
  for (let index = 0; index < length; index += 1) value = value * 256 + buffer[offset + index];
  return value;
}

function mp4DurationSeconds(buffer: Buffer) {
  if (indexOfSequence(buffer.subarray(0, Math.min(buffer.length, 128)), [0x66, 0x74, 0x79, 0x70]) < 0) return null;
  const marker = [0x6d, 0x76, 0x68, 0x64];
  const markerIndex = indexOfSequence(buffer, marker);
  if (markerIndex < 4) return null;
  const boxStart = markerIndex - 4;
  const version = buffer[boxStart + 8];
  if (version === 0 && boxStart + 28 <= buffer.length) {
    const timescale = buffer.readUInt32BE(boxStart + 20);
    const duration = buffer.readUInt32BE(boxStart + 24);
    return timescale > 0 && duration > 0 ? duration / timescale : null;
  }
  if (version === 1 && boxStart + 40 <= buffer.length) {
    const timescale = buffer.readUInt32BE(boxStart + 28);
    const duration = Number(buffer.readBigUInt64BE(boxStart + 32));
    return timescale > 0 && Number.isSafeInteger(duration) && duration > 0 ? duration / timescale : null;
  }
  return null;
}

function webmDurationSeconds(buffer: Buffer) {
  if (indexOfSequence(buffer.subarray(0, Math.min(buffer.length, 8)), [0x1a, 0x45, 0xdf, 0xa3]) !== 0) return null;
  const scaleMarker = [0x2a, 0xd7, 0xb1];
  const durationMarker = [0x44, 0x89];
  const scaleIndex = indexOfSequence(buffer, scaleMarker);
  const durationIndex = indexOfSequence(buffer, durationMarker);
  if (scaleIndex < 0 || durationIndex < 0) return null;
  const scaleSize = readEbmlVint(buffer, scaleIndex + scaleMarker.length);
  const durationSize = readEbmlVint(buffer, durationIndex + durationMarker.length);
  if (!scaleSize || !durationSize) return null;
  const scale = readUnsigned(buffer, scaleIndex + scaleMarker.length + scaleSize.length, scaleSize.value);
  const durationOffset = durationIndex + durationMarker.length + durationSize.length;
  let duration: number | null = null;
  if (durationSize.value === 4 && durationOffset + 4 <= buffer.length) duration = buffer.readFloatBE(durationOffset);
  if (durationSize.value === 8 && durationOffset + 8 <= buffer.length) duration = buffer.readDoubleBE(durationOffset);
  if (!scale || !duration || !Number.isFinite(duration) || duration <= 0) return null;
  return (duration * scale) / 1_000_000_000;
}

function assertImageBytes(buffer: Buffer, contentType: string) {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!((contentType === "image/jpeg" && jpeg) || (contentType === "image/png" && png) || (contentType === "image/webp" && webp))) {
    throw new HttpsError("failed-precondition", "The uploaded file does not match its image type.");
  }
}

function assertVideoBytes(buffer: Buffer, contentType: string) {
  const duration = contentType === "video/mp4" ? mp4DurationSeconds(buffer) : webmDurationSeconds(buffer);
  if (!duration || !Number.isFinite(duration)) throw new HttpsError("failed-precondition", "The uploaded video metadata could not be verified.");
  if (duration > MAX_VIDEO_DURATION_SECONDS + 0.05) throw new HttpsError("failed-precondition", "Videos can be up to 30 seconds long.");
  return duration;
}

async function removeStorageObject(storagePath: string) {
  await storageBucket.file(storagePath).delete({ ignoreNotFound: true });
}

export const claimUsername = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in to claim a username.");

  const data = request.data as { username?: unknown; displayName?: unknown };
  if (typeof data.username !== "string") throw new HttpsError("invalid-argument", "A username is required.");

  const username = normalizeUsername(data.username);
  if (!USERNAME_PATTERN.test(username)) throw new HttpsError("invalid-argument", "Username format is invalid.");

  const uid = request.auth.uid;
  await enforceRateLimit(uid, "usernameClaim");
  const usernameRef = firestore.collection("usernames").doc(username);
  const profileRef = firestore.collection("users").doc(uid);
  const displayName = typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim().slice(0, 50) : username;

  return firestore.runTransaction(async (transaction) => {
    const usernameSnapshot = await transaction.get(usernameRef);
    const profileSnapshot = await transaction.get(profileRef);

    if (usernameSnapshot.exists && usernameSnapshot.data()?.uid !== uid) {
      throw new HttpsError("already-exists", "That username is already taken.");
    }

    if (profileSnapshot.exists && profileSnapshot.data()?.username !== username) {
      throw new HttpsError("already-exists", "This account already has a different username.");
    }

    if (!usernameSnapshot.exists) {
      transaction.create(usernameRef, {
        uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (!profileSnapshot.exists) {
      transaction.create(profileRef, {
        uid,
        username,
        displayName,
        avatarPath: null,
        bio: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { username };
  });
});

export const sendFollowRequest = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { targetUid?: unknown };
  if (typeof data.targetUid !== "string" || !data.targetUid.trim()) {
    throw new HttpsError("invalid-argument", "A target user is required.");
  }

  const targetUid = data.targetUid.trim();
  if (targetUid === uid) throw new HttpsError("failed-precondition", "You cannot follow yourself.");
  await enforceRateLimit(uid, "followRequest");

  const targetSnapshot = await firestore.collection("users").doc(targetUid).get();
  if (!targetSnapshot.exists) throw new HttpsError("not-found", "That profile does not exist.");

  const requestId = `${uid}_${targetUid}`;
  const requestRef = firestore.collection("followRequests").doc(requestId);
  const friendshipRef = firestore.collection("friendships").doc(pairId(uid, targetUid));

  await firestore.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    const friendshipSnapshot = await transaction.get(friendshipRef);

    if (friendshipSnapshot.exists) throw new HttpsError("already-exists", "You are already friends.");
    if (requestSnapshot.exists && requestSnapshot.data()?.status === "pending") {
      throw new HttpsError("already-exists", "This follow request is already active.");
    }

    transaction.set(requestRef, {
      fromUid: uid,
      toUid: targetUid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      respondedAt: null,
    });
  });

  return { requestId };
});

export const respondToFollowRequest = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { requestId?: unknown; decision?: unknown };
  if (typeof data.requestId !== "string" || !data.requestId.trim()) {
    throw new HttpsError("invalid-argument", "A follow request is required.");
  }
  if (data.decision !== "accepted" && data.decision !== "rejected") {
    throw new HttpsError("invalid-argument", "Choose accept or reject.");
  }

  const requestId = data.requestId.trim();
  const requestRef = firestore.collection("followRequests").doc(requestId);
  await enforceRateLimit(uid, "followResponse");

  const response = await firestore.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new HttpsError("not-found", "That follow request no longer exists.");

    const followRequest = requestSnapshot.data() ?? {};
    if (followRequest.toUid !== uid) throw new HttpsError("permission-denied", "Only the recipient can respond.");
    if (followRequest.status !== "pending") throw new HttpsError("failed-precondition", "That request has already been handled.");

    const status = data.decision as "accepted" | "rejected";
    const friendshipId = pairId(followRequest.fromUid, followRequest.toUid);
    const friendshipRef = firestore.collection("friendships").doc(friendshipId);
    const conversationRef = firestore.collection("conversations").doc(friendshipId);
    const friendshipSnapshot = status === "accepted" ? await transaction.get(friendshipRef) : null;
    const response = {
      status,
      respondedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.update(requestRef, response);

    if (status === "rejected") return { status, memberUids: null };

    if (!friendshipSnapshot?.exists) {
      transaction.create(friendshipRef, {
        memberUids: [followRequest.fromUid, followRequest.toUid],
        status: "active",
        sourceRequestId: requestId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.set(conversationRef, {
      memberUids: [followRequest.fromUid, followRequest.toUid],
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastMessageAt: null,
      lastMessagePreview: null,
    }, { merge: true });

    return { friendshipId, status, memberUids: [followRequest.fromUid, followRequest.toUid] as [string, string] };
  });
  if (response.status === "accepted" && response.friendshipId && response.memberUids) {
    try {
      await grantRealtimeConversationAccess(response.friendshipId, response.memberUids[0], response.memberUids[1]);
    } catch (error) {
      console.error("Could not synchronize private realtime access.", error);
    }
  }
  return response.friendshipId ? { friendshipId: response.friendshipId, status: response.status } : { status: response.status };
});

export const cancelFollowRequest = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { requestId?: unknown };
  if (typeof data.requestId !== "string" || !data.requestId.trim()) {
    throw new HttpsError("invalid-argument", "A follow request is required.");
  }

  const requestRef = firestore.collection("followRequests").doc(data.requestId.trim());
  await enforceRateLimit(uid, "followResponse");
  const requestSnapshot = await requestRef.get();
  if (!requestSnapshot.exists) throw new HttpsError("not-found", "That follow request no longer exists.");

  const followRequest = requestSnapshot.data() ?? {};
  if (followRequest.fromUid !== uid) throw new HttpsError("permission-denied", "Only the sender can cancel.");
  if (followRequest.status !== "pending") throw new HttpsError("failed-precondition", "That request has already been handled.");

  await requestRef.update({
    status: "cancelled",
    updatedAt: FieldValue.serverTimestamp(),
    respondedAt: FieldValue.serverTimestamp(),
  });
  return { status: "cancelled" };
});

export const sendMessage = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { conversationId?: unknown; text?: unknown };
  if (typeof data.conversationId !== "string" || !data.conversationId.trim()) {
    throw new HttpsError("invalid-argument", "A conversation is required.");
  }
  if (typeof data.text !== "string") throw new HttpsError("invalid-argument", "Message text is required.");

  const text = data.text.trim();
  if (!text) throw new HttpsError("invalid-argument", "Message text is required.");
  if (text.length > 4000) throw new HttpsError("invalid-argument", "Messages are limited to 4,000 characters.");

  const conversationId = data.conversationId.trim();
  await enforceRateLimit(uid, "message");
  const conversationRef = firestore.collection("conversations").doc(conversationId);
  const conversationSnapshot = await conversationRef.get();
  if (!conversationSnapshot.exists) throw new HttpsError("not-found", "That conversation does not exist.");

  const conversation = conversationSnapshot.data() ?? {};
  const memberUids = Array.isArray(conversation.memberUids) ? conversation.memberUids : [];
  if (!memberUids.includes(uid) || conversation.status !== "active") {
    throw new HttpsError("permission-denied", "You are not a member of this conversation.");
  }

  const messageRef = conversationRef.collection("messages").doc();
  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  const batch = firestore.batch();
  batch.create(messageRef, {
    senderUid: uid,
    type: "text",
    text,
    storagePath: null,
    contentType: null,
    bytes: null,
    durationSeconds: null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    readAt: null,
  });
  batch.set(conversationRef, {
    updatedAt: FieldValue.serverTimestamp(),
    lastMessageAt: FieldValue.serverTimestamp(),
    lastMessagePreview: "New message",
  }, { merge: true });
  await batch.commit();

  return { messageId: messageRef.id };
});

export const createMediaUpload = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const upload = assertUploadRequest(request.data as { conversationId?: unknown; type?: unknown; contentType?: unknown; bytes?: unknown; durationSeconds?: unknown });
  await enforceRateLimit(uid, "mediaUpload");
  await assertActiveConversation(upload.conversationId, uid);

  const messageId = firestore.collection("conversations").doc(upload.conversationId).collection("messages").doc().id;
  const storagePath = expectedMediaPath(upload.conversationId, messageId);
  await firestore.collection("mediaUploads").doc(messageId).create({
    conversationId: upload.conversationId,
    senderUid: uid,
    type: upload.type,
    contentType: upload.contentType,
    bytes: upload.bytes,
    storagePath,
    createdAt: FieldValue.serverTimestamp(),
    uploadExpiresAt: Timestamp.fromMillis(Date.now() + MEDIA_UPLOAD_LIFETIME_MS),
  });

  return { messageId, storagePath };
});

export const abortMediaUpload = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { conversationId?: unknown; messageId?: unknown };
  if (typeof data.conversationId !== "string" || !data.conversationId.trim() || typeof data.messageId !== "string" || !data.messageId.trim()) {
    throw new HttpsError("invalid-argument", "A media upload is required.");
  }

  const ticketRef = firestore.collection("mediaUploads").doc(data.messageId.trim());
  const ticketSnapshot = await ticketRef.get();
  if (!ticketSnapshot.exists) return { cancelled: true };
  const ticket = ticketSnapshot.data() ?? {};
  if (ticket.conversationId !== data.conversationId.trim() || ticket.senderUid !== uid || ticket.storagePath !== expectedMediaPath(data.conversationId.trim(), data.messageId.trim())) {
    throw new HttpsError("permission-denied", "You cannot cancel this media upload.");
  }

  await Promise.all([removeStorageObject(ticket.storagePath), ticketRef.delete()]);
  return { cancelled: true };
});

export const finalizeMediaUpload = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { conversationId?: unknown; messageId?: unknown };
  if (typeof data.conversationId !== "string" || !data.conversationId.trim() || typeof data.messageId !== "string" || !data.messageId.trim()) {
    throw new HttpsError("invalid-argument", "A media upload is required.");
  }

  const conversationId = data.conversationId.trim();
  const messageId = data.messageId.trim();
  await enforceRateLimit(uid, "mediaFinalize");
  const messageRef = firestore.collection("conversations").doc(conversationId).collection("messages").doc(messageId);
  const existingMessage = await messageRef.get();
  if (existingMessage.exists && existingMessage.data()?.senderUid === uid) return { messageId };

  const ticketRef = firestore.collection("mediaUploads").doc(messageId);
  const ticketSnapshot = await ticketRef.get();
  if (!ticketSnapshot.exists) throw new HttpsError("not-found", "This media upload has expired. Choose the file again.");

  const ticket = ticketSnapshot.data() ?? {};
  if (ticket.conversationId !== conversationId || ticket.senderUid !== uid || !isMediaType(ticket.type) || !allowedContentType(ticket.type, ticket.contentType) || typeof ticket.bytes !== "number" || typeof ticket.storagePath !== "string") {
    throw new HttpsError("permission-denied", "This media upload is not valid.");
  }
  if (ticket.storagePath !== expectedMediaPath(conversationId, messageId)) throw new HttpsError("permission-denied", "This media upload path is not valid.");
  if (!(ticket.uploadExpiresAt instanceof Timestamp) || ticket.uploadExpiresAt.toMillis() <= Date.now()) {
    await Promise.all([removeStorageObject(ticket.storagePath), ticketRef.delete()]);
    throw new HttpsError("deadline-exceeded", "This media upload timed out. Choose the file again.");
  }

  const storageFile = storageBucket.file(ticket.storagePath);
  try {
    await assertActiveConversation(conversationId, uid);
    const [metadata] = await storageFile.getMetadata();
    const uploadedBytes = Number(metadata.size ?? 0);
    const uploadedContentType = metadata.contentType ?? "";
    const uploadedCacheControl = metadata.cacheControl ?? "";
    if (!Number.isSafeInteger(uploadedBytes) || uploadedBytes !== ticket.bytes || uploadedBytes <= 0 || uploadedBytes > mediaByteLimit(ticket.type) || uploadedContentType !== ticket.contentType || uploadedCacheControl !== PRIVATE_CACHE_CONTROL) {
      throw new HttpsError("failed-precondition", "The uploaded file does not match the approved media details.");
    }
    const [buffer] = await storageFile.download();
    const durationSeconds = ticket.type === "image" ? (assertImageBytes(buffer, uploadedContentType), null) : assertVideoBytes(buffer, uploadedContentType);
    const conversationRef = firestore.collection("conversations").doc(conversationId);
    const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

    await firestore.runTransaction(async (transaction) => {
      const [freshTicket, conversationSnapshot, currentMessage] = await Promise.all([
        transaction.get(ticketRef),
        transaction.get(conversationRef),
        transaction.get(messageRef),
      ]);
      if (currentMessage.exists) return;
      if (!freshTicket.exists) throw new HttpsError("not-found", "This media upload is no longer available.");
      const conversation = conversationSnapshot.data() ?? {};
      const memberUids = Array.isArray(conversation.memberUids) ? conversation.memberUids : [];
      if (!conversationSnapshot.exists || !memberUids.includes(uid) || conversation.status !== "active") {
        throw new HttpsError("permission-denied", "You are not a member of this conversation.");
      }
      transaction.create(messageRef, {
        senderUid: uid,
        type: ticket.type,
        text: null,
        storagePath: ticket.storagePath,
        contentType: uploadedContentType,
        bytes: uploadedBytes,
        durationSeconds,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
        readAt: null,
      });
      transaction.set(conversationRef, {
        updatedAt: FieldValue.serverTimestamp(),
        lastMessageAt: FieldValue.serverTimestamp(),
        lastMessagePreview: ticket.type === "image" ? "Shared an image" : "Shared a video",
      }, { merge: true });
      transaction.delete(ticketRef);
    });
    return { messageId };
  } catch (error) {
    await Promise.allSettled([removeStorageObject(ticket.storagePath), ticketRef.delete()]);
    throw error;
  }
});

export const createStatusUpload = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const upload = assertStatusUploadRequest(request.data as { type?: unknown; contentType?: unknown; bytes?: unknown; durationSeconds?: unknown });
  await enforceRateLimit(uid, "statusUpload");
  const statusId = firestore.collection("statuses").doc().id;
  const storagePath = expectedStatusPath(statusId);
  await firestore.collection("statusUploads").doc(statusId).create({
    ownerUid: uid,
    type: upload.type,
    contentType: upload.contentType,
    bytes: upload.bytes,
    storagePath,
    createdAt: FieldValue.serverTimestamp(),
    uploadExpiresAt: Timestamp.fromMillis(Date.now() + MEDIA_UPLOAD_LIFETIME_MS),
  });
  return { statusId, storagePath };
});

export const abortStatusUpload = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { statusId?: unknown };
  if (typeof data.statusId !== "string" || !data.statusId.trim()) throw new HttpsError("invalid-argument", "A status upload is required.");

  const ticketRef = firestore.collection("statusUploads").doc(data.statusId.trim());
  const ticketSnapshot = await ticketRef.get();
  if (!ticketSnapshot.exists) return { cancelled: true };
  const ticket = ticketSnapshot.data() ?? {};
  if (ticket.ownerUid !== uid || ticket.storagePath !== expectedStatusPath(data.statusId.trim())) throw new HttpsError("permission-denied", "You cannot cancel this status upload.");
  await Promise.all([removeStorageObject(ticket.storagePath), ticketRef.delete()]);
  return { cancelled: true };
});

export const finalizeStatusUpload = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { statusId?: unknown };
  if (typeof data.statusId !== "string" || !data.statusId.trim()) throw new HttpsError("invalid-argument", "A status upload is required.");

  const statusId = data.statusId.trim();
  await enforceRateLimit(uid, "statusFinalize");
  const statusRef = firestore.collection("statuses").doc(statusId);
  const existingStatus = await statusRef.get();
  if (existingStatus.exists && existingStatus.data()?.ownerUid === uid) return { statusId };

  const ticketRef = firestore.collection("statusUploads").doc(statusId);
  const ticketSnapshot = await ticketRef.get();
  if (!ticketSnapshot.exists) throw new HttpsError("not-found", "This status upload has expired. Choose the file again.");
  const ticket = ticketSnapshot.data() ?? {};
  if (ticket.ownerUid !== uid || !isMediaType(ticket.type) || !allowedContentType(ticket.type, ticket.contentType) || typeof ticket.bytes !== "number" || typeof ticket.storagePath !== "string") {
    throw new HttpsError("permission-denied", "This status upload is not valid.");
  }
  if (ticket.storagePath !== expectedStatusPath(statusId)) throw new HttpsError("permission-denied", "This status upload path is not valid.");
  if (!(ticket.uploadExpiresAt instanceof Timestamp) || ticket.uploadExpiresAt.toMillis() <= Date.now()) {
    await Promise.all([removeStorageObject(ticket.storagePath), ticketRef.delete()]);
    throw new HttpsError("deadline-exceeded", "This status upload timed out. Choose the file again.");
  }

  const storageFile = storageBucket.file(ticket.storagePath);
  try {
    const [metadata, profileSnapshot] = await Promise.all([
      storageFile.getMetadata().then(([result]) => result),
      firestore.collection("users").doc(uid).get(),
    ]);
    if (!profileSnapshot.exists) throw new HttpsError("not-found", "Your profile could not be found.");
    const uploadedBytes = Number(metadata.size ?? 0);
    const uploadedContentType = metadata.contentType ?? "";
    const uploadedCacheControl = metadata.cacheControl ?? "";
    if (!Number.isSafeInteger(uploadedBytes) || uploadedBytes !== ticket.bytes || uploadedBytes <= 0 || uploadedBytes > mediaByteLimit(ticket.type) || uploadedContentType !== ticket.contentType || uploadedCacheControl !== PRIVATE_CACHE_CONTROL) {
      throw new HttpsError("failed-precondition", "The uploaded file does not match the approved media details.");
    }
    const [buffer] = await storageFile.download();
    const durationSeconds = ticket.type === "image" ? (assertImageBytes(buffer, uploadedContentType), null) : assertVideoBytes(buffer, uploadedContentType);
    const profile = profileSnapshot.data() ?? {};
    const ownerUsername = typeof profile.username === "string" ? profile.username : "member";
    const ownerDisplayName = typeof profile.displayName === "string" && profile.displayName.trim() ? profile.displayName.trim().slice(0, 50) : ownerUsername;
    const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

    await firestore.runTransaction(async (transaction) => {
      const [freshTicket, currentStatus] = await Promise.all([transaction.get(ticketRef), transaction.get(statusRef)]);
      if (currentStatus.exists) {
        if (freshTicket.exists) transaction.delete(ticketRef);
        return;
      }
      if (!freshTicket.exists) throw new HttpsError("not-found", "This status upload is no longer available.");
      transaction.create(statusRef, {
        ownerUid: uid,
        ownerDisplayName,
        ownerUsername,
        audience: "friends",
        type: ticket.type,
        storagePath: ticket.storagePath,
        contentType: uploadedContentType,
        bytes: uploadedBytes,
        durationSeconds,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
      });
      transaction.delete(ticketRef);
    });
    return { statusId };
  } catch (error) {
    await Promise.allSettled([removeStorageObject(ticket.storagePath), ticketRef.delete()]);
    throw error;
  }
});

export const deleteStatus = onCall(callableOptions, async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as { statusId?: unknown };
  if (typeof data.statusId !== "string" || !data.statusId.trim()) throw new HttpsError("invalid-argument", "A status is required.");
  const statusRef = firestore.collection("statuses").doc(data.statusId.trim());
  const statusSnapshot = await statusRef.get();
  if (!statusSnapshot.exists) return { deleted: true };
  const status = statusSnapshot.data() ?? {};
  if (status.ownerUid !== uid) throw new HttpsError("permission-denied", "You can only delete your own status.");
  const viewers = await statusRef.collection("viewers").get();
  if (status.storagePath === expectedStatusPath(statusRef.id)) await removeStorageObject(status.storagePath);
  await Promise.all(viewers.docs.map((viewer) => viewer.ref.delete()));
  await statusRef.delete();
  return { deleted: true };
});

export const deleteMessageMedia = onDocumentDeleted("conversations/{conversationId}/messages/{messageId}", async (event) => {
  const message = event.data?.data();
  const expectedPath = expectedMediaPath(event.params.conversationId, event.params.messageId);
  if (message?.storagePath !== expectedPath) return;
  await removeStorageObject(expectedPath);
});

export const deleteStatusMedia = onDocumentDeleted("statuses/{statusId}", async (event) => {
  const status = event.data?.data();
  const expectedPath = expectedStatusPath(event.params.statusId);
  if (status?.storagePath === expectedPath) await removeStorageObject(expectedPath);
  const viewers = await firestore.collection("statuses").doc(event.params.statusId).collection("viewers").get();
  await Promise.all(viewers.docs.map((viewer) => viewer.ref.delete()));
});

const CLEANUP_BATCH_SIZE = 100;
const CLEANUP_BATCHES_PER_RUN = 5;
const CLEANUP_WORKERS = 10;

async function processInChunks<T>(items: T[], operation: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += CLEANUP_WORKERS) {
    await Promise.all(items.slice(index, index + CLEANUP_WORKERS).map(operation));
  }
}

async function purgeExpiredMessages(now: Timestamp) {
  for (let page = 0; page < CLEANUP_BATCHES_PER_RUN; page += 1) {
    const expiredMessages = await firestore.collectionGroup("messages").where("expiresAt", "<=", now).orderBy("expiresAt", "asc").limit(CLEANUP_BATCH_SIZE).get();
    if (expiredMessages.empty) return;
    await processInChunks(expiredMessages.docs, async (message) => {
      const data = message.data();
      const conversationRef = message.ref.parent.parent;
      const expectedPath = conversationRef ? expectedMediaPath(conversationRef.id, message.id) : null;
      if (expectedPath && data.storagePath === expectedPath) await removeStorageObject(expectedPath);
      await message.ref.delete();
      if (conversationRef && data.createdAt instanceof Timestamp) {
        await firestore.runTransaction(async (transaction) => {
          const conversation = await transaction.get(conversationRef);
          const lastMessageAt = conversation.data()?.lastMessageAt;
          if (conversation.exists && lastMessageAt instanceof Timestamp && lastMessageAt.toMillis() <= data.createdAt.toMillis()) {
            transaction.set(conversationRef, {
              lastMessageAt: null,
              lastMessagePreview: null,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
          }
        });
      }
    });
    if (expiredMessages.size < CLEANUP_BATCH_SIZE) return;
  }
}

async function purgeExpiredMediaUploads(now: Timestamp) {
  for (let page = 0; page < CLEANUP_BATCHES_PER_RUN; page += 1) {
    const expiredUploads = await firestore.collection("mediaUploads").where("uploadExpiresAt", "<=", now).orderBy("uploadExpiresAt", "asc").limit(CLEANUP_BATCH_SIZE).get();
    if (expiredUploads.empty) return;
    await processInChunks(expiredUploads.docs, async (upload) => {
      const data = upload.data();
      if (typeof data.conversationId === "string" && data.storagePath === expectedMediaPath(data.conversationId, upload.id)) {
        await removeStorageObject(data.storagePath);
      }
      await upload.ref.delete();
    });
    if (expiredUploads.size < CLEANUP_BATCH_SIZE) return;
  }
}

async function purgeExpiredStatuses(now: Timestamp) {
  for (let page = 0; page < CLEANUP_BATCHES_PER_RUN; page += 1) {
    const expiredStatuses = await firestore.collection("statuses").where("expiresAt", "<=", now).orderBy("expiresAt", "asc").limit(CLEANUP_BATCH_SIZE).get();
    if (expiredStatuses.empty) return;
    await processInChunks(expiredStatuses.docs, async (status) => {
      const data = status.data();
      const expectedPath = expectedStatusPath(status.id);
      if (data.storagePath === expectedPath) await removeStorageObject(expectedPath);
      const viewers = await status.ref.collection("viewers").get();
      await processInChunks(viewers.docs, async (viewer) => { await viewer.ref.delete(); });
      await status.ref.delete();
    });
    if (expiredStatuses.size < CLEANUP_BATCH_SIZE) return;
  }
}

async function purgeExpiredStatusUploads(now: Timestamp) {
  for (let page = 0; page < CLEANUP_BATCHES_PER_RUN; page += 1) {
    const expiredUploads = await firestore.collection("statusUploads").where("uploadExpiresAt", "<=", now).orderBy("uploadExpiresAt", "asc").limit(CLEANUP_BATCH_SIZE).get();
    if (expiredUploads.empty) return;
    await processInChunks(expiredUploads.docs, async (upload) => {
      const data = upload.data();
      if (data.storagePath === expectedStatusPath(upload.id)) await removeStorageObject(data.storagePath);
      await upload.ref.delete();
    });
    if (expiredUploads.size < CLEANUP_BATCH_SIZE) return;
  }
}

async function purgeExpiredRateLimits(now: Timestamp) {
  const expiredRateLimits = await firestore.collection("rateLimits").where("cleanupAt", "<=", now).orderBy("cleanupAt", "asc").limit(CLEANUP_BATCH_SIZE).get();
  await processInChunks(expiredRateLimits.docs, async (rateLimit) => { await rateLimit.ref.delete(); });
}

export const purgeExpiredChatMedia = onSchedule({ schedule: "every 5 minutes", timeZone: "UTC", retryCount: 3, maxInstances: 1 }, async () => {
  const now = Timestamp.now();
  await Promise.all([
    purgeExpiredMessages(now),
    purgeExpiredMediaUploads(now),
    purgeExpiredStatuses(now),
    purgeExpiredStatusUploads(now),
    purgeExpiredRateLimits(now),
  ]);
});

/**
 * Small deployment smoke test. Business operations are added in later phases
 * and remain server-authoritative; browser code never receives Admin access.
 */
export const healthCheck = onRequest({ cors: true }, (_request, response) => {
  response.json({
    ok: true,
    service: "vynq-chat-functions",
    project: adminApp.options.projectId ?? "unknown",
  });
});
