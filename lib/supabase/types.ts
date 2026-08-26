import type { User } from "@supabase/supabase-js";

export type VynqUser = User & {
  emailVerified: boolean;
  uid: string;
  displayName: string | null;
};

export function mapUser(user: User | null): VynqUser | null {
  if (!user) return null;
  return Object.assign(user, {
    emailVerified: Boolean(user.email_confirmed_at),
    uid: user.id,
    displayName: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? null,
  });
}
