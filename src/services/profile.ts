import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  type FirestoreDataConverter,
} from "firebase/firestore";
import { requireFirebase } from "@/lib/firebase/app";
import type { UserProfile, PrivacySettings } from "@/lib/firebase/types";
import { normalizeUsername } from "@/lib/validation";
import { LIMITS } from "@/lib/constants";

export type { UserProfile };

const defaultPrivacy: PrivacySettings = {
  whoCanRequest: "everyone",
  showOnline: true,
  showLastSeen: true,
  readReceipts: true,
  statusVisibility: "friends",
  notifyMessages: true,
  notifyFriendRequests: true,
  notifyStatus: true,
};

const converter: FirestoreDataConverter<UserProfile> = {
  toFirestore(p) {
    return { ...p };
  },
  fromFirestore(snap) {
    return snap.data() as UserProfile;
  },
};

export function userDocRef(uid: string) {
  const { db } = requireFirebase();
  return doc(db, "users", uid).withConverter(converter);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const lower = normalizeUsername(username);
  if (!lower) return false;
  const { db } = requireFirebase();
  // The username registry is publicly readable (no auth required) so the
  // pre-sign-in registration step can check availability. It stores only the
  // lowercased username + owner uid — never the email.
  const snap = await getDoc(doc(db, "usernames", lower));
  return !snap.exists();
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function createProfile(params: {
  uid: string;
  email: string;
  username: string;
  displayName: string;
}): Promise<UserProfile> {
  const { db } = requireFirebase();
  const lower = normalizeUsername(params.username);
  const ref = userDocRef(params.uid);
  const profile: UserProfile = {
    uid: params.uid,
    username: params.username,
    usernameLower: lower,
    email: params.email,
    displayName: params.displayName || params.username,
    bio: "",
    photoURL: "",
    createdAt: Date.now(),
    lastSeen: Date.now(),
    isOnline: false,
    emailVerified: false,
    statusEnabled: true,
    privacy: { ...defaultPrivacy },
    friendsCount: 0,
    followersCount: 0,
    followingCount: 0,
  };
  await setDoc(ref, profile);
  // Reserve the username in the public, email-free registry. This is the ONLY
  // place that grants username uniqueness; the read used during registration is
  // public (no auth), so it must live in its own collection (not users/).
  await setDoc(doc(db, "usernames", lower), {
    usernameLower: lower,
    username: params.username,
    uid: params.uid,
  });
  return profile;
}

export async function updateProfile(
  uid: string,
  patch: Partial<UserProfile>,
): Promise<void> {
  const ref = userDocRef(uid);
  await updateDoc(ref, patch as Record<string, unknown>);
}

export async function updatePrivacy(uid: string, privacy: PrivacySettings): Promise<void> {
  const ref = userDocRef(uid);
  await updateDoc(ref, { privacy });
}

export async function searchUsersByUsername(term: string, limit = 20) {
  const lower = normalizeUsername(term);
  if (!lower) return [];
  const { db } = requireFirebase();
  // Indexed prefix query via usernameLower range.
  const end = lower + "";
  const q = query(
    collection(db, "users")
      .withConverter(converter),
    where("usernameLower", ">=", lower),
    where("usernameLower", "<", end),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((u) => u.uid)
    .slice(0, limit);
}

export { LIMITS };
