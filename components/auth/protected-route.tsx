"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/routing";
import AuthLoadingScreen from "@/components/auth/auth-loading-screen";
import { useAuth } from "@/lib/auth/auth-provider";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, status } = useAuth();

  useEffect(() => {
    if (!ready || status === "authenticated") return;
    router.replace(status === "unverified" ? "/verify-email" : "/login");
  }, [ready, router, status]);

  if (!ready || status !== "authenticated") return <AuthLoadingScreen />;
  return children;
}
