"use client";

import { useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";

type PermissionState = NotificationPermission | "unsupported";

export default function NotificationPermission() {
  const [permission, setPermission] = useState<PermissionState>(() => typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  };

  const isEnabled = permission === "granted";
  const isUnsupported = permission === "unsupported";
  const detail = isEnabled
    ? "You will get a quiet alert when a friend messages you."
    : permission === "denied"
      ? "Notifications are blocked. Allow them in your browser settings."
      : isUnsupported
        ? "This browser does not support web notifications."
        : "Get a quiet alert when a friend messages you.";

  return (
    <button
      type="button"
      onClick={() => void enableNotifications()}
      disabled={isEnabled || isUnsupported}
      className="flex w-full items-center gap-3 border-b border-line px-4 py-4 text-left last:border-b-0 hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand">
        {permission === "denied" || isUnsupported ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-ink">Message notifications</span>
        <span className="mt-1 block truncate text-[11px] text-ink-soft">{detail}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-brand-pale px-2.5 py-1.5 text-[10px] font-bold text-brand-strong">
        {isEnabled ? <Check className="h-3.5 w-3.5" /> : permission === "denied" ? "Blocked" : isUnsupported ? "Unavailable" : "Enable"}
      </span>
    </button>
  );
}
