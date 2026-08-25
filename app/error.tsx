"use client";

import { useEffect } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { reportClientFault } from "@/lib/monitoring/client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientFault("route_error");
  }, []);

  return <main className="flex min-h-[100svh] items-center justify-center bg-surface-soft p-5">
    <section className="w-full max-w-md rounded-[30px] border border-line bg-white p-7 text-center shadow-[0_22px_70px_rgba(68,100,150,0.13)] sm:p-9">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand-pale text-brand"><ShieldAlert className="h-6 w-6" /></span>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Private space protected</p>
      <h1 className="mt-2 text-[26px] font-bold tracking-[-0.055em] text-ink">Something did not load.</h1>
      <p className="mt-3 text-[12px] leading-6 text-ink-soft">No message or media content is shown here. Try again to reconnect with Vynq-chat.</p>
      <button type="button" onClick={reset} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(92,141,246,0.24)] transition hover:bg-brand-strong"><RefreshCw className="h-4 w-4" /> Try again</button>
    </section>
  </main>;
}
