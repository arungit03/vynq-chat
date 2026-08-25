"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, reload, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export type AuthStatus = "loading" | "signed-out" | "unverified" | "authenticated";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  ready: boolean;
  refreshUser: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    });
  }, []);

  const status: AuthStatus = !ready
    ? "loading"
    : !user
      ? "signed-out"
      : user.emailVerified
        ? "authenticated"
        : "unverified";

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    ready,
    refreshUser: async () => {
      if (!auth.currentUser) {
        setUser(null);
        return null;
      }
      await reload(auth.currentUser);
      setUser(auth.currentUser);
      return auth.currentUser;
    },
    signOutUser: async () => {
      await signOut(auth);
      setUser(null);
    },
  }), [ready, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
