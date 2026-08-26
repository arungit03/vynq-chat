import type { User } from "firebase/auth";

export type VynqUser = User & {
  emailVerified: boolean;
  uid: string;
  displayName: string | null;
};

/**
 * Wraps a Firebase User with the fields the app expects. `emailVerified` and
 * `uid` are already on the Firebase user; `displayName` defers to the auth
 * display name (which we also mirror into the Firestore profile).
 */
export function mapUser(user: User | null): VynqUser | null {
  if (!user) return null;
  return Object.assign(user, {
    emailVerified: user.emailVerified,
    uid: user.uid,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? null,
  });
}
