import { AppShell } from '@/components/navigation/AppShell'

/**
 * Protected application area (verified users only). The shell enforces auth
 * and email-verification gating on the client.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
