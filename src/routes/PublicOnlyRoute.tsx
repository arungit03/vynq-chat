import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/ui/Loader";

/** Routes for unauthenticated users (login/register). Redirects verified users home. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, emailVerified, loading, profile } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (firebaseUser && emailVerified && profile) return <Navigate to="/home" replace />;
  return <>{children}</>;
}
