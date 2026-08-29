import {
  collection, doc, getDocs, setDoc, updateDoc,
  query, where, orderBy, type FirestoreDataConverter,
} from "firebase/firestore";
import { requireFirebase } from "@/lib/firebase/app";
import type { Status, StatusType, UserProfile } from "@/lib/firebase/types";
import { STATUS_DEFAULT_TTL_MS, LIMITS } from "@/lib/constants";

const converter: FirestoreDataConverter<Status> = {
  toFirestore: (s) => ({ ...s }),
  fromFirestore: (s) => s.data() as Status,
};

export function statusDoc(id: string) {
  const { db } = requireFirebase();
  return doc(db, "statuses", id).withConverter(converter);
}

export async function createStatus(params: {
  owner: UserProfile;
  type: StatusType;
  mediaURL: string;
  mediaStoragePath: string;
  mediaContentType: string;
  text?: string;
  width?: number;
  height?: number;
  durationSec?: number;
}): Promise<Status> {
  const { db } = requireFirebase();
  const now = Date.now();
  const id = doc(collection(db, "statuses")).id;
  const status: Status = {
    id,
    ownerId: params.owner.uid,
    ownerUsername: params.owner.username,
    ownerDisplayName: params.owner.displayName,
    ownerPhotoURL: params.owner.photoURL,
    type: params.type,
    mediaURL: params.mediaURL,
    mediaStoragePath: params.mediaStoragePath,
    mediaContentType: params.mediaContentType,
    mediaWidth: params.width,
    mediaHeight: params.height,
    mediaDurationSec: params.durationSec,
    text: params.text,
    createdAt: now,
    expiresAt: now + STATUS_DEFAULT_TTL_MS,
    viewedBy: [],
  };
  await setDoc(statusDoc(id), status);
  return status;
}

/** Active statuses from a set of friend uids (excludes expired). */
export async function getFriendStatuses(friendIds: string[]): Promise<Status[]> {
  const { db } = requireFirebase();
  if (friendIds.length === 0) return [];
  const now = Date.now();
  const batches: string[][] = [];
  for (let i = 0; i < friendIds.length; i += 30) batches.push(friendIds.slice(i, i + 30));
  const results: Status[] = [];
  for (const ids of batches) {
    const q = query(
      collection(db, "statuses").withConverter(converter),
      where("ownerId", "in", ids),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const s = d.data();
      if (s.expiresAt > now) results.push(s);
    }
  }
  // sort by owner then time
  results.sort((a, b) => a.ownerId.localeCompare(b.ownerId) || a.createdAt - b.createdAt);
  return results;
}

export async function getMyStatuses(uid: string): Promise<Status[]> {
  const { db } = requireFirebase();
  const now = Date.now();
  const q = query(
    collection(db, "statuses").withConverter(converter),
    where("ownerId", "==", uid),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).filter((s) => s.expiresAt > now);
}

export async function markStatusViewed(status: Status, myId: string) {
  if (status.ownerId === myId) return;
  if (status.viewedBy.includes(myId)) return;
  await updateDoc(statusDoc(status.id), { viewedBy: [...status.viewedBy, myId] });
}

export { LIMITS };
export type { Status };
