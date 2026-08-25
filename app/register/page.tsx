"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AtSign, ArrowRight, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import AuthField from "@/components/auth/auth-field";
import AuthShell from "@/components/auth/auth-shell";
import PasswordInput from "@/components/auth/password-input";
import { getAuthErrorMessage, normalizeUsername, registerWithUsername, validateUsername } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { ready, status } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (status === "authenticated") router.replace("/home");
    if (status === "unverified") router.replace("/verify-email");
  }, [ready, router, status]);

  const usernameError = username ? validateUsername(username) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUsername = normalizeUsername(username);
    const validationError = validateUsername(cleanUsername);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await registerWithUsername({ username: cleanUsername, email, password });
      router.replace("/verify-email");
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Make your space" title="Start with a name." description="Create a verified Vynq identity. Your username is unique, your email stays private, and there is no confirm-password step." alternate={<span>Already here? <Link href="/login" className="font-bold text-brand-strong hover:underline">Sign in</Link></span>}>
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Username" icon={AtSign} value={username} onChange={(value) => setUsername(value.replace(/\s/g, ""))} placeholder="yourname" autoComplete="username" hint={usernameError ? <span className="text-[#b74d56]">{usernameError}</span> : "unique"} />
        <p className="-mt-1 px-1 text-[10px] leading-4 text-ink-faint">3–24 characters · lowercase letters, numbers, periods, or underscores</p>
        <AuthField label="Email address" icon={Mail} value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
        <div><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold text-ink">Password</span><span className="text-[10px] font-medium text-ink-faint">6+ characters</span></div><PasswordInput value={password} onChange={setPassword} placeholder="Create a password" autoComplete="new-password" /></div>
        {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
        <button disabled={loading} type="submit" className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[12px] font-bold text-white shadow-[0_12px_24px_rgba(92,141,246,0.24)] transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Creating your identity…" : "Create account"}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></button>
      </form>
      <p className="mt-5 text-center text-[10px] leading-4 text-ink-faint">By continuing, you agree that conversations and media are designed to expire automatically.</p>
    </AuthShell>
  );
}
