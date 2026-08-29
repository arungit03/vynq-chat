import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNavigation } from "./BottomNavigation";
import { OfflineBanner } from "./OfflineBanner";

/** Authenticated app shell: desktop sidebar + mobile bottom nav + offline banner. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-brand-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main className="flex min-h-0 flex-1 flex-col pb-16 md:pb-0">{children}</main>
      </div>
      <BottomNavigation />
    </div>
  );
}
