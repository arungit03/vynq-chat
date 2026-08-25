import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase/client";
import type {
  FollowRequest,
  FollowRequestStatus,
  RelationshipStatus,
  SocialFriend,
  SocialProfile,
  SocialSnapshot,
} from "@/lib/social/types";

export const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function profileFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): SocialProfile {
  const data = snapshot.data();
  return {
    uid: snapshot.id,
    username: typeof data.username === "string" ? data.username : snapshot.id,
    displayName: typeof data.displayName === "string" ? data.displayName : "Vynq member",
    avatarPath: typeof data.avatarPath === "string" ? data.avatarPath : null,
    bio: typeof data.bio === "string" ? data.bio : null,
    createdAt: data.createdAt,
  };
}

function requestFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): FollowRequest {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    fromUid: String(data.fromUid ?? ""),
    toUid: String(data.toUid ?? ""),
    status: (data.status ?? "pending") as FollowRequestStatus,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    respondedAt: data.respondedAt,
  };
}

function sortNewest<T extends { createdAt?: { toMillis?: () => number } }>(items: T[]) {
  return items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function fetchProfileByUid(uid: string) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? profileFromSnapshot(snapshot) : null;
}

export async function fetchProfileByUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) return null;

  const usernameSnapshot = await getDoc(doc(db, "usernames", normalized));
  if (!usernameSnapshot.exists()) return null;

  const uid = usernameSnapshot.data().uid;
  return typeof uid === "string" ? fetchProfileByUid(uid) : null;
}

export async function fetchRelationship(currentUid: string, targetUid: string): Promise<RelationshipStatus> {
  if (currentUid === targetUid) return "self";

  const [friendshipSnapshot, outgoingSnapshot, incomingSnapshot] = await Promise.all([
    getDocs(query(collection(db, "friendships"), where("memberUids", "array-contains", currentUid))),
    getDocs(query(collection(db, "followRequests"), where("fromUid", "==", currentUid), where("toUid", "==", targetUid), limit(1))),
    getDocs(query(collection(db, "followRequests"), where("fromUid", "==", targetUid), where("toUid", "==", currentUid), limit(1))),
  ]);

  const isFriend = friendshipSnapshot.docs.some((snapshot) => {
    const memberUids = snapshot.data().memberUids;
    return Array.isArray(memberUids) && memberUids.includes(targetUid);
  });
  if (isFriend) return "friends";
  if (outgoingSnapshot.docs[0]?.data().status === "pending") return "requested";
  if (incomingSnapshot.docs[0]?.data().status === "pending") return "incoming";
  return "none";
}

export async function fetchSocialSnapshot(uid: string): Promise<SocialSnapshot> {
  const [profileSnapshot, friendshipSnapshot, incomingSnapshot, outgoingSnapshot] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDocs(query(collection(db, "friendships"), where("memberUids", "array-contains", uid))),
    getDocs(query(collection(db, "followRequests"), where("toUid", "==", uid))),
    getDocs(query(collection(db, "followRequests"), where("fromUid", "==", uid))),
  ]);

  const profile = profileSnapshot.exists() ? profileFromSnapshot(profileSnapshot) : null;
  const incomingRequests = sortNewest(incomingSnapshot.docs.map(requestFromSnapshot).filter((request) => request.status === "pending"));
  const outgoingRequests = sortNewest(outgoingSnapshot.docs.map(requestFromSnapshot).filter((request) => request.status === "pending"));
  const acceptedIncoming = incomingSnapshot.docs.map(requestFromSnapshot).filter((request) => request.status === "accepted");
  const acceptedOutgoing = outgoingSnapshot.docs.map(requestFromSnapshot).filter((request) => request.status === "accepted");

  const friendRows = friendshipSnapshot.docs.map((snapshot) => {
    const memberUids = snapshot.data().memberUids;
    const friendUid = Array.isArray(memberUids) ? memberUids.find((memberUid) => memberUid !== uid) : null;
    return { friendshipId: snapshot.id, friendUid: typeof friendUid === "string" ? friendUid : null };
  }).filter((row): row is { friendshipId: string; friendUid: string } => Boolean(row.friendUid));

  const profileUids = Array.from(new Set([
    ...friendRows.map((row) => row.friendUid),
    ...incomingRequests.map((request) => request.fromUid),
    ...outgoingRequests.map((request) => request.toUid),
    ...acceptedIncoming.map((request) => request.fromUid),
    ...acceptedOutgoing.map((request) => request.toUid),
  ]));
  const profileEntries = await Promise.all(profileUids.map(async (profileUid) => [profileUid, await fetchProfileByUid(profileUid)] as const));
  const profiles = new Map(profileEntries.filter((entry): entry is [string, SocialProfile] => Boolean(entry[1])));

  const addProfile = (request: FollowRequest, uidKey: "fromUid" | "toUid") => ({
    ...request,
    profile: profiles.get(request[uidKey]) ?? null,
  });

  const friends: SocialFriend[] = friendRows.flatMap((row) => {
    const friendProfile = profiles.get(row.friendUid);
    return friendProfile ? [{ ...friendProfile, friendshipId: row.friendshipId }] : [];
  });

  return {
    profile,
    friends,
    followers: acceptedIncoming.flatMap((request) => {
      const follower = profiles.get(request.fromUid);
      return follower ? [follower] : [];
    }),
    following: acceptedOutgoing.flatMap((request) => {
      const followed = profiles.get(request.toUid);
      return followed ? [followed] : [];
    }),
    incomingRequests: incomingRequests.map((request) => addProfile(request, "fromUid")),
    outgoingRequests: outgoingRequests.map((request) => addProfile(request, "toUid")),
  };
}

export async function sendFollowRequest(targetUid: string) {
  const callable = httpsCallable<{ targetUid: string }, { requestId: string }>(functions, "sendFollowRequest");
  return callable({ targetUid });
}

export async function respondToFollowRequest(requestId: string, decision: "accepted" | "rejected") {
  const callable = httpsCallable<{ requestId: string; decision: "accepted" | "rejected" }, { friendshipId?: string; status: string }>(functions, "respondToFollowRequest");
  return callable({ requestId, decision });
}

export async function cancelFollowRequest(requestId: string) {
  const callable = httpsCallable<{ requestId: string }, { status: string }>(functions, "cancelFollowRequest");
  return callable({ requestId });
}

export function getSocialErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "functions/already-exists": "This request is already active or you are already friends.",
    "functions/failed-precondition": "That request is no longer available.",
    "functions/invalid-argument": "Check the profile and try again.",
    "functions/not-found": "The social service is not deployed yet. Deploy Functions before using requests.",
    "functions/permission-denied": "You need a verified email to manage connections.",
    "functions/unauthenticated": "Your session expired. Please sign in again.",
    "functions/unavailable": "The social service is temporarily unavailable.",
    "functions/resource-exhausted": "You have made too many requests. Please wait before trying again.",
  };
  return messages[code] || "Something went wrong. Please try again.";
}
