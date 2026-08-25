"use client";

import { LoaderCircle, LockKeyhole } from "lucide-react";

export default function AuthLoadingScreen({ message = "Checking your session…" }: { message?: string }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-canvas px-6 text-ink">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[19px] bg-brand text-white shadow-[0_12px_28px_rgba(92,141,246,0.25)]"><LockKeyhole className="h-6 w-6" /></div>
        <LoaderCircle className="mt-6 h-5 w-5 animate-spin text-brand" />
        <p className="mt-3 text-[12px] font-semibold text-ink-soft">{message}</p>
      </div>
    </main>
  );
}
