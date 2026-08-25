"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function NetworkStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    let activeRequest: AbortController | null = null;

    const confirmOffline = async () => {
      // navigator.onLine only describes the browser's network interface. It can
      // be false on working connections, so verify the same-origin app first.
      if (navigator.onLine) {
        setOffline(false);
        return;
      }

      activeRequest?.abort();
      const request = new AbortController();
      activeRequest = request;
      const timeout = window.setTimeout(() => request.abort(), 3_000);
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: request.signal,
        });
        if (active) setOffline(!response.ok);
      } catch {
        if (active) setOffline(true);
      } finally {
        window.clearTimeout(timeout);
        if (activeRequest === request) activeRequest = null;
      }
    };

    const markOnline = () => setOffline(false);
    const markOffline = () => { void confirmOffline(); };
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    void confirmOffline();
    return () => {
      active = false;
      activeRequest?.abort();
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (!offline) return null;

  return <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[80] mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl bg-ink px-3.5 py-2.5 text-[11px] font-semibold text-white shadow-float sm:bottom-5">
    <WifiOff className="h-4 w-4 shrink-0 text-brand-soft" />
    Connection interrupted. Private messages and media stay unavailable until you reconnect.
  </div>;
}
