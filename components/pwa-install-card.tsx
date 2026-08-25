"use client";

import { useEffect, useState } from "react";
import { Check, Command, Download, LoaderCircle } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(mediaQuery.matches || document.referrer.startsWith("android-app://"));
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    updateInstalled();
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    mediaQuery.addEventListener?.("change", updateInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      mediaQuery.removeEventListener?.("change", updateInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="mt-7 flex items-center gap-3 rounded-[22px] border border-line bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf8f3] text-success"><Command className="h-[18px] w-[18px]" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-ink">{installed ? "Vynq-chat is installed" : "Take Vynq with you"}</p>
        <p className="mt-1 text-[11px] leading-4 text-ink-soft">{installed ? "Open it like a private app on this device." : "Install the private workspace on your phone or desktop."}</p>
      </div>
      {installed ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8f3] px-2.5 py-1 text-[10px] font-bold text-success"><Check className="h-3 w-3" /> Installed</span> : installPrompt ? <button type="button" disabled={installing} onClick={() => void install()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-pale px-3 py-2 text-[10px] font-bold text-brand-strong hover:bg-brand-soft disabled:opacity-60">{installing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Install</button> : <span className="rounded-full bg-brand-pale px-2.5 py-1 text-[10px] font-bold text-brand-strong">PWA</span>}
    </div>
  );
}
