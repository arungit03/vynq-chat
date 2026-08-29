import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  reload,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, requireFirebase } from "@/lib/firebase/app";
import { getProfile, createProfile, type UserProfile } from "@/services/profile";
import type { AuthUser } from "@/lib/firebase/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  authUser: AuthUser | null;
  loading: boolean;
  emailVerified: boolean;
  /** Whether the user is fully authenticated: signed in + email verified + profile loaded. */
  ready: boolean;
  refreshProfile: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  setProfile: (p: UserProfile) => void;
  signInLocal: (p: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  // Presence: mark offline on unload; update lastSeen periodically (throttled).
  useEffect(() => {
    if (!firebaseUser || !profile) return;
    const { db } = requireFirebase();
    const ref = doc(db, "users", firebaseUser.uid);
    let lastPing = 0;
    const ping = () => {
      const now = Date.now();
      if (now - lastPing > 60_000) {
        lastPing = now;
        updateDoc(ref, { isOnline: true, lastSeen: serverTimestamp() }).catch(() => {});
      }
    };
    ping();
    const interval = setInterval(ping, 60_000);
    const markOffline = () => {
      updateDoc(ref, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
    };
    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") markOffline();
      else ping();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, [firebaseUser, profile]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setProfileState(null);
        setEmailVerified(false);
        setLoading(false);
        return;
      }
      setEmailVerified(fbUser.emailVerified);
      try {
        let p = await getProfile(fbUser.uid);
        if (!p) {
          // Edge case: auth exists but profile write failed earlier.
          p = await createProfile({
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            username: fbUser.uid.slice(0, 8),
            displayName: fbUser.email?.split("@")[0] ?? "User",
          });
          const { db } = requireFirebase();
          await updateDoc(doc(db, "users", fbUser.uid), { emailVerified: fbUser.emailVerified });
        } else if (p.emailVerified !== fbUser.emailVerified) {
          const { db } = requireFirebase();
          await updateDoc(doc(db, "users", fbUser.uid), { emailVerified: fbUser.emailVerified });
          p = { ...p, emailVerified: fbUser.emailVerified };
        }
        setProfileState(p);
      } catch (e) {
        console.error("Failed loading profile", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    const p = await getProfile(firebaseUser.uid);
    if (p) setProfileState(p);
  }, [firebaseUser]);

  const setProfile = useCallback((p: UserProfile) => setProfileState(p), []);

  const signInLocal = useCallback((p: UserProfile) => setProfileState(p), []);

  const refreshEmailVerification = useCallback(async () => {
    if (!firebaseUser) return false;

    // Firebase updates emailVerified on the server when the email link is
    // opened. Reload the current user so the open app sees that change too.
    await reload(firebaseUser);
    const verified = firebaseUser.emailVerified;
    setEmailVerified(verified);
    if (verified) {
      setProfileState((current) => (current ? { ...current, emailVerified: true } : current));
    }
    return verified;
  }, [firebaseUser]);

  // Keep emailVerified in sync on reload.
  useEffect(() => {
    if (firebaseUser) setEmailVerified(firebaseUser.emailVerified);
  }, [firebaseUser]);

  const ready =
    !!firebaseUser && firebaseUser.emailVerified && !!profile && !loading;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        authUser: firebaseUser
          ? { uid: firebaseUser.uid, email: firebaseUser.email, emailVerified: firebaseUser.emailVerified }
          : null,
        loading,
        emailVerified,
        ready,
        refreshProfile,
        refreshEmailVerification,
        setProfile,
        signInLocal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
