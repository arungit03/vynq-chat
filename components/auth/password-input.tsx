"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function PasswordInput({ value, onChange, placeholder = "Your password", autoComplete = "current-password" }: { value: string; onChange: (value: string) => void; placeholder?: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="group flex h-13 items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 transition focus-within:border-brand/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/10">
      <LockKeyhole className="h-[17px] w-[17px] shrink-0 text-ink-faint group-focus-within:text-brand" />
      <input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint" />
      <button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((current) => !current)} className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-faint hover:bg-brand-pale hover:text-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15">
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
