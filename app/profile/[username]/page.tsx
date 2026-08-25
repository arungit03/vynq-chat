"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/auth/protected-route";
import PublicProfilePage from "@/components/social/public-profile-page";
import { useAuth } from "@/lib/auth/auth-provider";

export default function PublicProfileRoute() {
  const params = useParams<{ username: string }>();
  const { user } = useAuth();

  return <ProtectedRoute>{user ? <PublicProfilePage username={params.username} currentUid={user.uid} /> : null}</ProtectedRoute>;
}
