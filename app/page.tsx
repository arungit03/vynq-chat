"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/routing";
import AuthLoadingScreen from "@/components/auth/auth-loading-screen";
import { useAuth } from "@/lib/auth/auth-provider";

export default function Home() {
  const router = useRouter();
  const { ready, status } = useAuth();

  useEffect(() => {
    if (!ready) return;
    router.replace(status === "authenticated" ? "/home" : status === "unverified" ? "/verify-email" : "/login");
  }, [ready, router, status]);

  return <AuthLoadingScreen message="Opening your private space…" />;
}
