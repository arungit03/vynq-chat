import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/ui/Loader";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, emailVerified, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Signed in but email not verified -> verification screen.
  if (!emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  // Signed in + verified but profile not yet loaded.
  if (!profile) return <FullScreenLoader />;

  return <>{children}</>;
}
