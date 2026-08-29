import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/ui/Loader";

/** Routes that require Firebase authentication but may be used before email verification. */
export function SignedInRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
