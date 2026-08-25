"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import AuthField from "@/components/auth/auth-field";
import AuthShell from "@/components/auth/auth-shell";
import PasswordInput from "@/components/auth/password-input";
import { getAuthErrorMessage, loginWithEmail, sendPasswordReset } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { ready, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (status === "authenticated") router.replace("/home");
    if (status === "unverified") router.replace("/verify-email");
  }, [ready, router, status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const user = await loginWithEmail(email, password);
      router.replace(user.emailVerified ? "/home" : "/verify-email");
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email first so we know where to send the reset link.");
      return;
    }
    setError("");
    setNotice("");
    try {
      await sendPasswordReset(email);
      setNotice("If an account exists for this email, a reset link is on its way.");
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError));
    }
  };

  return (
    <AuthShell eyebrow="Welcome back" title="Back to your people." description="Sign in to return to conversations that are meant to stay simple and short-lived." alternate={<span>New to Vynq? <Link href="/register" className="font-bold text-brand-strong hover:underline">Create account</Link></span>}>
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Email address" icon={Mail} value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
        <div><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold text-ink">Password</span><button type="button" onClick={resetPassword} className="text-[10px] font-bold text-brand-strong hover:underline">Forgot password?</button></div><PasswordInput value={password} onChange={setPassword} /></div>
        {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
        {notice ? <p role="status" className="rounded-2xl border border-success/25 bg-success-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-success">{notice}</p> : null}
        <button disabled={loading} type="submit" className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[12px] font-bold text-white shadow-[0_12px_24px_rgba(92,141,246,0.24)] transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Opening your space…" : "Sign in"}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></button>
      </form>
      <div className="mt-7 flex items-center gap-3 text-[10px] font-semibold text-ink-faint"><span className="h-px flex-1 bg-line" /> verified email required <span className="h-px flex-1 bg-line" /></div>
    </AuthShell>
  );
}
