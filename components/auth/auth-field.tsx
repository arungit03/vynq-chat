"use client";

import type { LucideIcon } from "lucide-react";

export default function AuthField({ label, icon: Icon, value, onChange, placeholder, type = "text", autoComplete, hint }: { label: string; icon: LucideIcon; value: string; onChange: (value: string) => void; placeholder: string; type?: string; autoComplete?: string; hint?: React.ReactNode }) {
  return (
    <label className="block"><span className="mb-2 flex items-center justify-between text-[11px] font-bold text-ink"><span>{label}</span>{hint ? <span className="font-medium text-ink-faint">{hint}</span> : null}</span><span className="group flex h-13 items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 transition focus-within:border-brand/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/10"><Icon className="h-[17px] w-[17px] shrink-0 text-ink-faint group-focus-within:text-brand" /><input required type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint" /></span></label>
  );
}
