"use client";

import { Link } from "@/lib/routing";
import { ArrowUpRight, Check, LockKeyhole, MessageCircle, TimerReset } from "lucide-react";

function BrandLockup() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand text-white shadow-[0_10px_24px_rgba(92,141,246,0.28)]"><MessageCircle className="h-5 w-5 fill-white/95 stroke-brand" strokeWidth={2.4} /><span className="absolute bottom-[9px] left-[13px] h-1.5 w-1.5 rounded-full bg-brand" /></span>
      <span><span className="block text-[15px] font-bold tracking-[-0.04em] text-ink">Vynq<span className="text-brand">.</span></span><span className="block text-[9px] font-semibold uppercase tracking-[0.19em] text-ink-faint">private by design</span></span>
    </Link>
  );
}

export default function AuthShell({ eyebrow, title, description, alternate, children }: { eyebrow: string; title: string; description: string; alternate: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="min-h-[100svh] bg-canvas text-ink lg:p-5">
      <div className="mx-auto flex min-h-[100svh] max-w-[1480px] overflow-hidden bg-white shadow-soft lg:min-h-[calc(100svh-2.5rem)] lg:rounded-[30px]">
        <section className="relative hidden w-[43%] overflow-hidden bg-[#eaf1ff] p-10 lg:flex lg:flex-col xl:p-14">
          <div className="brand-gradient absolute inset-0 opacity-[0.14]" />
          <div className="auth-grid absolute inset-0 opacity-60" />
          <div className="auth-glow absolute -right-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-[#b7d6ff]/65 blur-3xl" />
          <div className="auth-glow absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-[#d9c7ff]/45 blur-3xl" />
          <div className="relative z-10"><BrandLockup /></div>
          <div className="relative z-10 mt-auto max-w-[32rem] pb-7">
            <p className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink"><span className="h-1.5 w-1.5 rounded-full bg-success" /> A quieter kind of social</p>
            <h2 className="max-w-[550px] text-[clamp(2.7rem,4.2vw,4.8rem)] font-bold leading-[0.96] tracking-[-0.075em] text-ink">Keep the people.<br /><span className="bg-gradient-to-br from-brand-strong to-[#7c6cf0] bg-clip-text text-transparent">Lose the trail.</span></h2>
            <p className="mt-6 max-w-[28rem] text-[14px] leading-6 text-ink-soft">Vynq gives your conversations a place to happen, then lets them fade when their time is up.</p>
            <div className="mt-9 grid max-w-[29rem] grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-white/80 bg-white/70 p-4 shadow-[0_12px_30px_rgba(47,99,230,0.08)] backdrop-blur-sm"><LockKeyhole className="h-4 w-4 text-brand" /><p className="mt-4 text-[12px] font-bold text-ink">Verified people</p><p className="mt-1 text-[10px] leading-4 text-ink-soft">Email verification before entry.</p></div>
              <div className="rounded-[20px] border border-white/80 bg-white/70 p-4 shadow-[0_12px_30px_rgba(47,99,230,0.08)] backdrop-blur-sm"><TimerReset className="h-4 w-4 text-brand" /><p className="mt-4 text-[12px] font-bold text-ink">Short-lived by default</p><p className="mt-1 text-[10px] leading-4 text-ink-soft">Messages leave after 24 hours.</p></div>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-2 text-[10px] font-semibold text-brand-ink"><Check className="h-3.5 w-3.5 text-success" /> Privacy-first foundation for Vynq-chat</div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="flex items-center justify-between px-6 pb-2 pt-7 sm:px-10 lg:justify-end lg:pt-8"><div className="lg:hidden"><BrandLockup /></div><div className="flex items-center gap-2 text-[11px] font-semibold text-ink-soft">{alternate}</div></header>
          <div className="flex flex-1 items-center px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
            <div className="mx-auto w-full max-w-[430px] enter-up">
              <div className="mb-8"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</p><h1 className="text-[clamp(2.1rem,4vw,3.2rem)] font-bold leading-[1] tracking-[-0.065em] text-ink">{title}</h1><p className="mt-3 max-w-[380px] text-[13px] leading-5 text-ink-soft">{description}</p></div>
              {children}
              <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-[10px] leading-4 text-ink-faint"><LockKeyhole className="h-3 w-3" /> Your account controls access to every private space.</p>
            </div>
          </div>
          <footer className="flex items-center justify-between px-6 pb-6 text-[10px] text-ink-faint sm:px-10 lg:px-16 xl:px-24"><span>© 2026 Vynq-chat</span><span className="inline-flex items-center gap-1.5">Explore the quiet <ArrowUpRight className="h-3 w-3" /></span></footer>
        </section>
      </div>
    </main>
  );
}
