import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase/client";
import type { ChatMediaKind } from "@/lib/chat/types";
import type { StatusUploadTicket, StoryStatus } from "@/lib/status/types";

function statusFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): StoryStatus {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ownerUid: String(data.ownerUid ?? ""),
    ownerDisplayName: typeof data.ownerDisplayName === "string" ? data.ownerDisplayName : "Vynq member",
    ownerUsername: typeof data.ownerUsername === "string" ? data.ownerUsername : "member",
    type: data.type === "video" ? "video" : "image",
    storagePath: typeof data.storagePath === "string" ? data.storagePath : "",
    contentType: typeof data.contentType === "string" ? data.contentType : "",
    bytes: typeof data.bytes === "number" ? data.bytes : 0,
    durationSeconds: typeof data.durationSeconds === "number" ? data.durationSeconds : null,
    createdAt: data.createdAt ?? null,
    expiresAt: data.expiresAt ?? null,
  };
}

function newestFirst(statuses: StoryStatus[]) {
  return [...statuses].sort((left, right) => (right.createdAt?.toMillis() ?? 0) - (left.createdAt?.toMillis() ?? 0));
}

export function listenToStatusFeed(ownerUids: string[], onStatuses: (statuses: StoryStatus[]) => void, onError: (error: Error) => void) {
  const owners = Array.from(new Set(ownerUids.filter(Boolean)));
  const byOwner = new Map<string, StoryStatus[]>();
  const publish = () => onStatuses(newestFirst(Array.from(byOwner.values()).flat()));
  const unsubscribers = owners.map((ownerUid) => onSnapshot(
    query(
      collection(db, "statuses"),
      where("ownerUid", "==", ownerUid),
      where("expiresAt", ">", Timestamp.fromMillis(Date.now())),
      orderBy("expiresAt", "asc"),
    ),
    (snapshot) => {
      byOwner.set(ownerUid, snapshot.docs.map(statusFromSnapshot));
      publish();
    },
    onError,
  ));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function createStatusUpload(media: { kind: ChatMediaKind; contentType: string; bytes: number; durationSeconds: number | null }) {
  const callable = httpsCallable<
    { type: ChatMediaKind; contentType: string; bytes: number; durationSeconds: number | null },
    StatusUploadTicket
  >(functions, "createStatusUpload");
  const result = await callable({ type: media.kind, contentType: media.contentType, bytes: media.bytes, durationSeconds: media.durationSeconds });
  return result.data;
}

export async function finalizeStatusUpload(statusId: string) {
  const callable = httpsCallable<{ statusId: string }, { statusId: string }>(functions, "finalizeStatusUpload");
  const result = await callable({ statusId });
  return result.data;
}

export async function abortStatusUpload(statusId: string) {
  const callable = httpsCallable<{ statusId: string }, { cancelled: true }>(functions, "abortStatusUpload");
  const result = await callable({ statusId });
  return result.data;
}

export async function deleteStatus(statusId: string) {
  const callable = httpsCallable<{ statusId: string }, { deleted: true }>(functions, "deleteStatus");
  const result = await callable({ statusId });
  return result.data;
}

export async function markStatusSeen(statusId: string, currentUid: string) {
  const viewerRef = doc(db, "statuses", statusId, "viewers", currentUid);
  const existing = await getDoc(viewerRef);
  if (existing.exists()) return;
  await setDoc(viewerRef, { uid: currentUid, seenAt: serverTimestamp() });
}

export async function getSeenStatusIds(statusIds: string[], currentUid: string) {
  const snapshots = await Promise.allSettled(statusIds.map((statusId) => getDoc(doc(db, "statuses", statusId, "viewers", currentUid))));
  return new Set(snapshots.flatMap((result, index) => result.status === "fulfilled" && result.value.exists() ? [statusIds[index]] : []));
}

export async function getStatusViewerCount(statusId: string) {
  const viewers = await getDocs(collection(db, "statuses", statusId, "viewers"));
  return viewers.size;
}

export function getStatusErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "functions/failed-precondition": "This media could not be shared as a status.",
    "functions/invalid-argument": "Choose a supported image, MP4, or WebM file.",
    "functions/not-found": "This status is no longer available.",
    "functions/permission-denied": "Verify your email before sharing a status.",
    "functions/deadline-exceeded": "The upload timed out. Choose the file again.",
    "functions/resource-exhausted": "You have shared too many statuses. Please wait before trying again.",
  };
  return messages[code] || (error instanceof Error && error.message ? error.message : "Status could not be shared. Try again.");
}
