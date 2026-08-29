import {
  collection, doc, getDocs, setDoc, updateDoc, query, where, orderBy, writeBatch,
  type FirestoreDataConverter,
} from "firebase/firestore";
import { requireFirebase } from "@/lib/firebase/app";
import type { AppNotification } from "@/lib/firebase/types";

const converter: FirestoreDataConverter<AppNotification> = {
  toFirestore: (n) => ({ ...n }),
  fromFirestore: (s) => s.data() as AppNotification,
};

export function notificationsCol(uid: string) {
  const { db } = requireFirebase();
  return collection(db, "users", uid, "notifications").withConverter(converter);
}

export async function getNotifications(uid: string, max = 50): Promise<AppNotification[]> {
  const q = query(notificationsCol(uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.slice(0, max).map((d) => d.data());
}

export async function addNotification(uid: string, n: Omit<AppNotification, "id" | "ownerId" | "read" | "createdAt">) {
  const ref = doc(notificationsCol(uid));
  const notification: AppNotification = {
    ...n,
    id: ref.id,
    ownerId: uid,
    read: false,
    createdAt: Date.now(),
  };
  await setDoc(ref, notification);
  return notification;
}

export async function markNotificationRead(uid: string, id: string) {
  const { db } = requireFirebase();
  await updateDoc(doc(db, "users", uid, "notifications", id), { read: true });
}

export async function markAllRead(uid: string) {
  const q = query(notificationsCol(uid), where("read", "==", false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const { db } = requireFirebase();
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function unreadCount(uid: string): Promise<number> {
  const q = query(notificationsCol(uid), where("read", "==", false));
  const snap = await getDocs(q);
  return snap.size;
}
