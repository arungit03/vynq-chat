import VynqShell from "@/components/vynq-shell";
import ProtectedRoute from "@/components/auth/protected-route";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <VynqShell />
    </ProtectedRoute>
  );
}
