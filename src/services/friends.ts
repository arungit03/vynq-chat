import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, runTransaction,
  query, where,
  type FirestoreDataConverter,
} from "firebase/firestore";
import { requireFirebase } from "@/lib/firebase/app";
import type { FriendRequest, UserProfile } from "@/lib/firebase/types";
import { getProfile } from "./profile";

const reqConverter: FirestoreDataConverter<FriendRequest> = {
  toFirestore: (r) => ({ ...r }),
  fromFirestore: (s) => s.data() as FriendRequest,
};

export function friendRequestDoc(id: string) {
  const { db } = requireFirebase();
  return doc(db, "friendRequests", id).withConverter(reqConverter);
}

export type { FriendRequest };

/** Deterministic request id so a duplicate is a no-op (idempotent). */
export function requestIdBetween(senderId: string, receiverId: string): string {
  return [senderId, receiverId].sort().join("_");
}

export async function getRelation(myId: string, otherId: string) {
  // Returns the existing friend request (any status) between the two, if any.
  const id = requestIdBetween(myId, otherId);
  const snap = await getDoc(friendRequestDoc(id));
  if (snap.exists()) return { request: snap.data(), status: snap.data().status as FriendRequest["status"] };
  return { request: null, status: null as FriendRequest["status"] | null };
}

export async function sendFriendRequest(sender: UserProfile, receiver: UserProfile) {
  if (sender.uid === receiver.uid) throw new Error("You can't add yourself.");
  const id = requestIdBetween(sender.uid, receiver.uid);
  const existing = await getDoc(friendRequestDoc(id));
  if (existing.exists()) {
    const st = existing.data().status;
    if (st === "pending") throw new Error("Request already sent.");
    if (st === "accepted") throw new Error("You're already connected.");
    if (st === "blocked") throw new Error("This user is blocked.");
  }
  const req: FriendRequest = {
    id,
    senderId: sender.uid,
    senderUsername: sender.username,
    senderDisplayName: sender.displayName,
    senderPhotoURL: sender.photoURL,
    receiverId: receiver.uid,
    receiverUsername: receiver.username,
    status: "pending",
    createdAt: Date.now(),
  };
  await setDoc(friendRequestDoc(id), req);
  return req;
}

export async function getIncomingRequests(myId: string): Promise<FriendRequest[]> {
  const { db } = requireFirebase();
  const q = query(
    collection(db, "friendRequests").withConverter(reqConverter),
    where("receiverId", "==", myId),
    // Filter status locally so request visibility does not depend on a
    // composite index still being built in a newly-created Firebase project.
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((request) => request.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOutgoingRequests(myId: string): Promise<FriendRequest[]> {
  const { db } = requireFirebase();
  const q = query(
    collection(db, "friendRequests").withConverter(reqConverter),
    where("senderId", "==", myId),
    // See getIncomingRequests: this keeps the request list usable before a
    // composite index finishes provisioning.
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((request) => request.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function acceptFriendRequest(request: FriendRequest) {
  const { db, auth } = requireFirebase();
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("You must be signed in to accept a request.");
  if (request.receiverId !== currentUid) throw new Error("You can't accept this request.");

  const requestRef = friendRequestDoc(request.id);
  const friendshipRef = doc(db, "friendships", request.id);

  // Keep the status change and friendship creation in one atomic operation.
  // This makes accepting work even when optional Cloud Functions are not
  // deployed, while the Firestore rules still require the matching receiver
  // and accepted request for the friendship write.
  await runTransaction(db, async (transaction) => {
    const liveRequest = await transaction.get(requestRef);
    const liveFriendship = await transaction.get(friendshipRef);
    if (!liveRequest.exists()) throw new Error("This request no longer exists.");

    const data = liveRequest.data();
    if (data.receiverId !== currentUid) throw new Error("You can't accept this request.");
    if (data.status !== "pending" && data.status !== "accepted") {
      throw new Error("This request is no longer pending.");
    }

    if (data.status === "pending") {
      transaction.update(requestRef, { status: "accepted" });
    }
    if (!liveFriendship.exists()) {
      transaction.set(friendshipRef, {
        id: request.id,
        userIds: [data.senderId, data.receiverId],
        userA: data.senderId,
        userB: data.receiverId,
        createdAt: Date.now(),
      });
    }
  });
}

export async function rejectFriendRequest(request: FriendRequest) {
  await updateDoc(friendRequestDoc(request.id), { status: "rejected" });
}

export async function cancelFriendRequest(request: FriendRequest) {
  await updateDoc(friendRequestDoc(request.id), { status: "rejected" });
}

export async function areFriends(myId: string, otherId: string): Promise<boolean> {
  const { db } = requireFirebase();
  const fid = requestIdBetween(myId, otherId);
  const snap = await getDoc(doc(db, "friendships", fid));
  return snap.exists();
}

export async function getFriends(myId: string, limit = 50): Promise<UserProfile[]> {
  const { db } = requireFirebase();
  const q = query(collection(db, "friendships"), where("userIds", "array-contains", myId));
  const snap = await getDocs(q);
  const ids = snap.docs.map((d) => d.data().userIds.find((id: string) => id !== myId)).filter(Boolean);
  const profiles: UserProfile[] = [];
  for (const id of ids.slice(0, limit)) {
    const p = await getProfile(id);
    if (p) profiles.push(p);
  }
  return profiles;
}
