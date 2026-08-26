import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
  type FirestoreDataConverter,
} from "firebase/firestore";
import { Timestamp, toTimestamp } from "@/lib/time";
import type { ChatMediaKind, ChatMessage, ConversationMeta, PresenceState } from "@/lib/chat/types";
import type { FollowRequest, FollowRequestStatus, RelationshipStatus, SocialFriend, SocialProfile, SocialSnapshot } from "@/lib/social/types";
import type { StoryStatus } from "@/lib/status/types";
import { auth, db } from "./client";

const MESSAGE_LIFETIME_MS = 24 * 60 * 60 * 1000;

// ---- Converters: Firestore Timestamp <-> local Timestamp -------------------

function toLocal(value: unknown): Timestamp | null {
  if (!value) return null;
  // Firestore Timestamp has toMillis()
  if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return new Timestamp((value as { toMillis: () => number }).toMillis());
  }
  return toTimestamp(value);
}

// ---- Profiles -------------------------------------------------------------

export async function ensureProfile(uid: string, data: { email?: string | null; displayName?: string | null; username?: string | null }) {
  const ref = doc(db, "profiles", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    username: data.username ?? null,
    displayName: data.displayName ?? data.email?.split("@")[0] ?? "Vynq member",
    email: data.email ?? null,
    avatarPath: null,
    bio: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function fetchProfileByUid(uid: string): Promise<SocialProfile | null> {
  const snap = await getDoc(doc(db, "profiles", uid));
  if (!snap.exists()) return null;
  return profileFromDoc(snap.data());
}

export async function fetchProfileByUsername(username: string): Promise<SocialProfile | null> {
  const q = query(collection(db, "profiles"), where("username", "==", username.toLowerCase()), where("username", "!=", null));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return profileFromDoc(snap.docs[0].data());
}

function profileFromDoc(data: DocumentData): SocialProfile {
  return {
    uid: data.id ?? "",
    username: data.username ?? data.id?.slice(0, 8) ?? "member",
    displayName: data.displayName || "Vynq member",
    avatarPath: data.avatarPath ?? null,
    bio: data.bio ?? null,
    createdAt: toLocal(data.createdAt) ?? undefined,
  };
}

// ---- Username claiming (replaces claim_username RPC + unique constraint) ---

export async function claimUsername(uid: string, username: string, displayName: string) {
  const clean = username.toLowerCase().trim();
  if (!/^[a-z0-9._]{3,24}$/.test(clean)) throw new Error("Username format is invalid.");
  await runTransaction(db, async (tx) => {
    const usernameRef = doc(db, "usernames", clean);
    const usernameSnap = await tx.get(usernameRef);
    if (usernameSnap.exists() && usernameSnap.data().uid !== uid) {
      throw new Error("That username is already taken.");
    }
    const profileRef = doc(db, "profiles", uid);
    const profileSnap = await tx.get(profileRef);
    const existing = profileSnap.data()?.username as string | null | undefined;
    if (existing && existing !== clean) {
      const oldRef = doc(db, "usernames", existing);
      if ((await tx.get(oldRef)).exists()) tx.delete(oldRef);
    }
    tx.set(usernameRef, { uid, username: clean });
    tx.update(profileRef, { username: clean, displayName: displayName || clean, updatedAt: serverTimestamp() });
  });
}

// ---- Conversations ---------------------------------------------------------

export function listenToConversationMeta(conversationId: string, onMeta: (meta: ConversationMeta | null) => void, onError: (error: Error) => void) {
  const ref = doc(db, "conversations", conversationId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return onMeta(null);
    const d = snap.data();
    onMeta({
      id: snap.id,
      memberUids: d.memberUids ?? [],
      status: d.status ?? "active",
      lastMessageAt: toLocal(d.lastMessageAt),
      lastMessagePreview: d.lastMessagePreview ?? null,
      updatedAt: toLocal(d.updatedAt),
    });
  }, (error) => onError(error));
}

// ---- Messages -------------------------------------------------------------

export function listenToMessages(conversationId: string, onMessages: (messages: ChatMessage[]) => void, onError: (error: Error) => void) {
  const ref = collection(db, "conversations", conversationId, "messages");
  const q = query(ref, where("expiresAt", ">", new Date(Date.now() - MESSAGE_LIFETIME_MS)), orderBy("expiresAt", "asc"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    onMessages(snap.docs.map((d) => messageFromDoc(d.id, d.data())));
  }, (error) => onError(error));
}

function messageFromDoc(id: string, d: DocumentData): ChatMessage {
  return {
    id,
    senderUid: d.senderUid ?? "",
    type: d.type ?? "text",
    text: d.text ?? null,
    storagePath: d.storagePath ?? null,
    contentType: d.contentType ?? null,
    bytes: d.bytes ?? null,
    durationSeconds: d.durationSeconds ?? null,
    createdAt: toLocal(d.createdAt),
    expiresAt: toLocal(d.expiresAt),
    readAt: toLocal(d.readAt),
  };
}

export async function createTextMessage(conversationId: string, senderUid: string, text: string): Promise<string> {
  const ref = await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderUid,
    type: "text",
    text: text.trim(),
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + MESSAGE_LIFETIME_MS),
    readAt: null,
  });
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: text.trim().slice(0, 120),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createMediaMessage(conversationId: string, senderUid: string, media: { kind: ChatMediaKind; storagePath: string; contentType: string; bytes: number; durationSeconds: number | null }): Promise<string> {
  const ref = await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderUid,
    type: media.kind,
    storagePath: media.storagePath,
    contentType: media.contentType,
    bytes: media.bytes,
    durationSeconds: media.durationSeconds,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + MESSAGE_LIFETIME_MS),
    readAt: null,
  });
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: media.kind === "image" ? "📷 Photo" : "📹 Video",
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function markMessageRead(conversationId: string, messageId: string) {
  await updateDoc(doc(db, "conversations", conversationId, "messages", messageId), { readAt: serverTimestamp() });
}

// ---- Statuses --------------------------------------------------------------

export function listenToStatusFeed(ownerUids: string[], onStatuses: (statuses: StoryStatus[]) => void, onError: (error: Error) => void) {
  const owners = Array.from(new Set(ownerUids.filter(Boolean)));
  if (!owners.length) return () => onStatuses([]);
  const ref = collection(db, "statuses");
  const q = query(ref, where("ownerUid", "in", owners), where("expiresAt", ">", new Date()), orderBy("expiresAt", "desc"));
  return onSnapshot(q, async (snap) => {
    const rows = snap.docs.map((d) => statusFromDoc(d.id, d.data()));
    const profileSnaps = await Promise.all(owners.map((uid) => getDoc(doc(db, "profiles", uid))));
    const profileMap = new Map<string, SocialProfile>();
    profileSnaps.forEach((s) => { if (s.exists()) profileMap.set(s.id, profileFromDoc(s.data())); });
    onStatuses(rows.map((row) => {
      const profile = profileMap.get(row.ownerUid);
      return { ...row, ownerDisplayName: profile?.displayName ?? "member", ownerUsername: profile?.username ?? "member" };
    }));
  }, (error) => onError(error));
}

function statusFromDoc(id: string, d: DocumentData): StoryStatus {
  return {
    id,
    ownerUid: d.ownerUid ?? "",
    type: d.type ?? "image",
    storagePath: d.storagePath ?? "",
    contentType: d.contentType ?? "",
    bytes: d.bytes ?? 0,
    durationSeconds: d.durationSeconds ?? null,
    createdAt: toLocal(d.createdAt),
    expiresAt: toLocal(d.expiresAt),
  };
}

export async function createStatus(ownerUid: string, media: { kind: ChatMediaKind; storagePath: string; contentType: string; bytes: number; durationSeconds: number | null }): Promise<string> {
  const ref = await addDoc(collection(db, "statuses"), {
    ownerUid,
    type: media.kind,
    storagePath: media.storagePath,
    contentType: media.contentType,
    bytes: media.bytes,
    durationSeconds: media.durationSeconds,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + MESSAGE_LIFETIME_MS),
  });
  return ref.id;
}

export async function deleteStatus(statusId: string) {
  await deleteDoc(doc(db, "statuses", statusId));
}

// ---- Social graph ----------------------------------------------------------

export async function fetchRelationship(currentUid: string, targetUid: string): Promise<RelationshipStatus> {
  if (currentUid === targetUid) return "self";
  const q = query(collection(db, "followRequests"), where("fromUid", "in", [currentUid, targetUid]), where("toUid", "in", [currentUid, targetUid]));
  const snap = await getDocs(q);
  const requests = snap.docs.map((d) => d.data());
  const accepted = requests.find((r) => r.status === "accepted" && ((r.fromUid === currentUid && r.toUid === targetUid) || (r.fromUid === targetUid && r.toUid === currentUid)));
  if (accepted) return "friends";
  const outgoing = requests.find((r) => r.fromUid === currentUid && r.toUid === targetUid && r.status === "pending");
  if (outgoing) return "requested";
  const incoming = requests.find((r) => r.fromUid === targetUid && r.toUid === currentUid && r.status === "pending");
  if (incoming) return "incoming";
  return "none";
}

export async function fetchSocialSnapshot(uid: string): Promise<SocialSnapshot> {
  const requestsSnap = await getDocs(collection(db, "followRequests"));
  const all = requestsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{ id: string } & Record<string, unknown>>;
  const toProfile = async (id: string): Promise<SocialProfile | null> => fetchProfileByUid(id);

  const accepted = all.filter((r) => r.status === "accepted" && (r.fromUid === uid || r.toUid === uid));
  const friends: SocialFriend[] = [];
  for (const r of accepted) {
    const other = r.fromUid === uid ? (r.toUid as string) : (r.fromUid as string);
    const profile = await toProfile(other);
    if (profile) friends.push({ ...profile, friendshipId: r.id });
  }

  const incoming = all.filter((r) => r.toUid === uid && r.status === "pending");
  const outgoing = all.filter((r) => r.fromUid === uid && r.status === "pending");

  const collectProfiles = async (ids: string[]): Promise<SocialProfile[]> => {
    const profiles = await Promise.all(ids.map(toProfile));
    return profiles.filter((p): p is SocialProfile => Boolean(p));
  };

  const [followers, following, incomingRequests, outgoingRequests] = await Promise.all([
    collectProfiles(incoming.map((r) => r.fromUid as string)),
    collectProfiles(outgoing.map((r) => r.toUid as string)),
    Promise.all(incoming.map(async (r) => ({ ...requestFromDoc(r.id, r), profile: await toProfile(r.fromUid as string) }))),
    Promise.all(outgoing.map(async (r) => ({ ...requestFromDoc(r.id, r), profile: await toProfile(r.toUid as string) }))),
  ]);

  return {
    profile: await fetchProfileByUid(uid),
    friends,
    followers,
    following,
    incomingRequests: incomingRequests.map((r) => ({ ...r, profile: r.profile ?? null })),
    outgoingRequests: outgoingRequests.map((r) => ({ ...r, profile: r.profile ?? null })),
  };
}

function requestFromDoc(id: string, d: Record<string, unknown>): FollowRequest {
  return {
    id,
    fromUid: d.fromUid as string,
    toUid: d.toUid as string,
    status: d.status as FollowRequestStatus,
    createdAt: toLocal(d.createdAt),
    updatedAt: toLocal(d.updatedAt),
    respondedAt: toLocal(d.respondedAt),
  };
}

export async function sendFollowRequest(targetUid: string): Promise<string> {
  const fromUid = auth.currentUser?.uid;
  if (!fromUid) throw new Error("You must be signed in.");
  const ref = await addDoc(collection(db, "followRequests"), {
    fromUid,
    toUid: targetUid,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    respondedAt: null,
  });
  return ref.id;
}

export async function respondToFollowRequest(requestId: string, decision: "accepted" | "rejected"): Promise<{ friendshipId?: string }> {
  const ref = doc(db, "followRequests", requestId);
  if (decision === "accepted") {
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("That request no longer exists.");
      const { fromUid, toUid } = snap.data() as { fromUid: string; toUid: string };
      const friendRef = doc(collection(db, "friendships"));
      tx.set(friendRef, { memberUids: [fromUid, toUid], createdAt: serverTimestamp() });
      tx.update(ref, { status: "accepted", updatedAt: serverTimestamp(), respondedAt: serverTimestamp() });
      return { friendshipId: friendRef.id };
    });
  }
  await updateDoc(ref, { status: "rejected", updatedAt: serverTimestamp(), respondedAt: serverTimestamp() });
  return {};
}

export async function cancelFollowRequest(requestId: string) {
  await updateDoc(doc(db, "followRequests", requestId), { status: "cancelled", updatedAt: serverTimestamp() });
}

// ---- Presence & typing -----------------------------------------------------

export function listenToPresence(uid: string, onPresence: (presence: PresenceState | null) => void, _onError: (error: Error) => void) {
  const ref = doc(db, "presence", uid);
  return onSnapshot(ref, (snap) => {
    const d = snap.data();
    if (!d || (d.state !== "online" && d.state !== "offline")) return onPresence(null);
    onPresence({ state: d.state, lastChanged: toLocal(d.lastChanged)?.toMillis() });
  });
}

export function startPresence(uid: string): () => void {
  const ref = doc(db, "presence", uid);
  const mark = () => void setDoc(ref, { state: "online", lastChanged: serverTimestamp() }, { merge: true });
  const offline = () => void setDoc(ref, { state: "offline", lastChanged: serverTimestamp() }, { merge: true });
  mark();
  const timer = window.setInterval(mark, 30_000);
  const onHide = () => offline();
  window.addEventListener("pagehide", onHide);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("pagehide", onHide);
    offline();
  };
}

export function listenToTyping(conversationId: string, onTyping: (typing: boolean) => void, _onError: (error: Error) => void) {
  const ref = doc(db, "conversations", conversationId);
  return onSnapshot(ref, (snap) => {
    const d = snap.data();
    const ts = toLocal(d?.typingAt)?.toMillis() ?? 0;
    onTyping(Boolean(d?.typingUid) && Date.now() - ts < 5000);
  });
}

export async function setTyping(conversationId: string, uid: string, isTyping: boolean) {
  const ref = doc(db, "conversations", conversationId);
  await updateDoc(ref, isTyping ? { typingUid: uid, typingAt: serverTimestamp() } : { typingUid: null });
}
