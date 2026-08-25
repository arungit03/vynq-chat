import Link from "next/link";
import { ArrowLeft, LockKeyhole, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return <main className="flex min-h-[100svh] items-center justify-center bg-surface-soft p-5">
    <section className="w-full max-w-md rounded-[30px] border border-line bg-white p-7 text-center shadow-[0_22px_70px_rgba(68,100,150,0.13)] sm:p-9">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand-pale text-brand"><WifiOff className="h-6 w-6" /></span>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Vynq-chat is offline</p>
      <h1 className="mt-2 text-[26px] font-bold tracking-[-0.055em] text-ink">Reconnect to continue.</h1>
      <p className="mt-3 text-[12px] leading-6 text-ink-soft">Your messages, profiles, and media are intentionally never saved for offline viewing. Connect to the internet to load your private space.</p>
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-brand-pale px-4 py-3 text-left text-[11px] leading-5 text-ink-soft"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> This protects private content on shared or lost devices.</div>
      <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(92,141,246,0.24)] transition hover:bg-brand-strong"><ArrowLeft className="h-4 w-4" /> Try again</Link>
    </section>
  </main>;
}
