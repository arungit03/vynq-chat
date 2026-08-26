"use client";

import { FormEvent, useEffect, useState } from "react";
import { Link, useRouter } from "@/lib/routing";
import { AtSign, ArrowRight, Mail } from "lucide-react";
import AuthField from "@/components/auth/auth-field";
import AuthShell from "@/components/auth/auth-shell";
import GoogleIcon from "@/components/auth/google-icon";
import { getAuthErrorMessage, normalizeUsername, registerWithUsername, sendEmailOtp, signInWithGoogle, validateUsername } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { ready, status } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!ready || googleLoading) return;
    if (status === "authenticated") router.replace("/home");
    if (status === "unverified") router.replace("/verify-email");
  }, [googleLoading, ready, router, status]);

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
      await sendEmailOtp(email);
      window.localStorage.setItem("vynq_pending_username", cleanUsername);
      window.localStorage.setItem("vynq_pending_verification_email", email.trim());
      router.replace("/verify-email");
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (googleError) {
      setGoogleLoading(false);
      setError(getAuthErrorMessage(googleError));
    }
  };

  return (
    <AuthShell eyebrow="Make your space" title="Start with a name." description="Create a verified Vynq identity. Your username is unique, your email stays private, and there is no confirm-password step." alternate={<span>Already here? <Link href="/login" className="font-bold text-brand-strong hover:underline">Sign in</Link></span>}>
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Username" icon={AtSign} value={username} onChange={(value) => setUsername(value.replace(/\s/g, ""))} placeholder="yourname" autoComplete="username" hint={usernameError ? <span className="text-[#b74d56]">{usernameError}</span> : "unique"} />
        <p className="-mt-1 px-1 text-[10px] leading-4 text-ink-faint">3–24 characters · lowercase letters, numbers, periods, or underscores</p>
        <AuthField label="Email address" icon={Mail} value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
        {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
        <button disabled={loading} type="submit" className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[12px] font-bold text-white shadow-[0_12px_24px_rgba(92,141,246,0.24)] transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Sending your code…" : "Send code"}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></button>
      </form>
      <div className="my-5 flex items-center gap-3 text-[10px] font-semibold text-ink-faint"><span className="h-px flex-1 bg-line" /> or sign up with <span className="h-px flex-1 bg-line" /></div>
      <button disabled={loading || googleLoading} type="button" onClick={() => void continueWithGoogle()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[12px] font-bold text-ink-soft transition hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-60"><GoogleIcon /> {googleLoading ? "Connecting Google..." : "Continue with Google"}</button>
      <p className="mt-5 text-center text-[10px] leading-4 text-ink-faint">By continuing, you agree that conversations and media are designed to expire automatically.</p>
    </AuthShell>
  );
}
