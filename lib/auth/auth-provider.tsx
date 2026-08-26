import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { mapUser, type VynqUser } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";

export type AuthStatus = "loading" | "signed-out" | "unverified" | "authenticated";

type AuthContextValue = {
  user: VynqUser | null;
  status: AuthStatus;
  ready: boolean;
  authError: Error | null;
  /** True while a Google/OAuth code in the URL is being exchanged into a session. */
  completingOAuth: boolean;
  refreshUser: () => Promise<VynqUser | null>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getUrlParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.slice(1) || window.location.search);
}

// True when the current URL is a Supabase OAuth callback still awaiting exchange.
function hasPendingAuthInUrl() {
  const params = getUrlParams();
  return Boolean(params.get("code") || params.get("access_token") || params.get("refresh_token"));
}

// True when the callback URL carries an explicit OAuth error (e.g. the user
// denied Google, or Supabase refused the code). We surface these instead of
// silently bouncing to /login.
function oauthErrorInUrl(): string | null {
  const params = getUrlParams();
  return params.get("error_description") || params.get("error") || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<VynqUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [completingOAuth, setCompletingOAuth] = useState(false);

  useEffect(() => {
    let active = true;

    // An explicit error in the callback URL means the code exchange is moot.
    const redirectError = oauthErrorInUrl();
    if (redirectError) {
      setAuthError(new Error(redirectError));
      setReady(true);
      return;
    }

    const pendingAuth = hasPendingAuthInUrl();
    if (pendingAuth) setCompletingOAuth(true);

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      // getSession() awaits Supabase's own initialization, which exchanges the
      // OAuth code when present. So by the time this resolves on a valid
      // callback, the session is already established. If it resolves null while
      // we had a pending callback, the exchange failed (the error surfaces via
      // the URL or authError) and there is nothing left to wait for.
      if (error) setAuthError(error);
      const sessionUser = mapUser(data.session?.user ?? null);
      setUser(sessionUser);
      setCompletingOAuth(false);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") setCompletingOAuth(false);
      setAuthError(null);
      setUser(mapUser(session?.user ?? null));
      setReady(true);
    });

    // Safety net: if the OAuth code never resolves (expired/invalid link),
    // stop showing the loading state so the user is not stranded.
    let fallback: ReturnType<typeof setTimeout> | undefined;
    if (pendingAuth) {
      fallback = setTimeout(() => {
        if (active) {
          setCompletingOAuth(false);
          setReady(true);
        }
      }, 8000);
    }

    return () => {
      active = false;
      if (fallback) clearTimeout(fallback);
      data.subscription.unsubscribe();
    };
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
    authError,
    completingOAuth,
    refreshUser: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const nextUser = mapUser(data.user);
      setUser(nextUser);
      return nextUser;
    },
    signOutUser: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    },
  }), [authError, ready, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
