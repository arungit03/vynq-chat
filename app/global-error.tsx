"use client";

import { useEffect } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { reportClientFault } from "@/lib/monitoring/client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientFault("root_error");
  }, []);

  return <html lang="en"><body><main className="flex min-h-[100svh] items-center justify-center bg-[#f4f8fc] p-5"><section className="w-full max-w-md rounded-[30px] border border-[#dce7f3] bg-white p-7 text-center shadow-[0_22px_70px_rgba(68,100,150,0.13)] sm:p-9"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#e9f1ff] text-[#5c8df6]"><ShieldAlert className="h-6 w-6" /></span><h1 className="mt-5 text-[26px] font-bold tracking-[-0.055em] text-[#172943]">Vynq-chat needs a refresh.</h1><p className="mt-3 text-[12px] leading-6 text-[#697a91]">Your private content remains protected. Refresh to try loading the app again.</p><button type="button" onClick={reset} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#5c8df6] px-4 py-3 text-[11px] font-bold text-white"><RefreshCw className="h-4 w-4" /> Refresh</button></section></main></body></html>;
}
