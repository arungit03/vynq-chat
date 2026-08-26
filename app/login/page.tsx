"use client";

import { FormEvent, useEffect, useState } from "react";
import { Link, useRouter } from "@/lib/routing";
import { ArrowRight, Mail } from "lucide-react";
import AuthField from "@/components/auth/auth-field";
import AuthShell from "@/components/auth/auth-shell";
import GoogleIcon from "@/components/auth/google-icon";
import { getAuthErrorMessage, sendEmailOtp, signInWithGoogle, verifyEmailOtp } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { ready, status, authError } = useAuth();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!ready || googleLoading) return;
    if (status === "authenticated") router.replace("/home");
    if (status === "unverified") router.replace("/verify-email");
  }, [googleLoading, ready, router, status]);

  const oauthError = authError ? getAuthErrorMessage(authError) : "";

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await sendEmailOtp(email);
      setNotice("We sent a 6-digit code to your inbox. Check spam if it is missing.");
      setStep("otp");
    } catch (sendError) {
      setError(getAuthErrorMessage(sendError));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code we sent.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await verifyEmailOtp(email, code);
      router.replace(user.emailVerified ? "/home" : "/verify-email");
    } catch (verifyError) {
      setError(getAuthErrorMessage(verifyError));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await sendEmailOtp(email);
      setNotice("A fresh 6-digit code is on its way.");
    } catch (sendError) {
      setError(getAuthErrorMessage(sendError));
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    setNotice("");
    try {
      await signInWithGoogle();
    } catch (googleError) {
      setGoogleLoading(false);
      setError(getAuthErrorMessage(googleError));
    }
  };

  return (
    <AuthShell eyebrow="Welcome back" title="Back to your people." description="Sign in with a one-time code sent to your email. No password to remember." alternate={<span>New to Vynq? <Link href="/register" className="font-bold text-brand-strong hover:underline">Create account</Link></span>}>
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <AuthField label="Email address" icon={Mail} value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
          {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
          {oauthError ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{oauthError}</p> : null}
          {notice ? <p role="status" className="rounded-2xl border border-success/25 bg-success-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-success">{notice}</p> : null}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong disabled:opacity-60">{loading ? "Sending…" : <>Send code <ArrowRight className="h-4 w-4" /></>}</button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="px-1 text-[11px] leading-5 text-ink-soft">Code sent to <span className="font-bold text-ink">{email}</span></p>
          <AuthField label="6-digit code" icon={Mail} value={code} onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" />
          {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
          {notice ? <p role="status" className="rounded-2xl border border-success/25 bg-success-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-success">{notice}</p> : null}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong disabled:opacity-60">{loading ? "Verifying…" : <>Verify <ArrowRight className="h-4 w-4" /></>}</button>
          <div className="flex items-center justify-between text-[10px] font-bold">
            <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); setNotice(""); }} className="text-brand-strong hover:underline">Use a different email</button>
            <button type="button" onClick={() => void resendCode()} disabled={loading} className="text-brand-strong hover:underline disabled:opacity-60">Resend code</button>
          </div>
        </form>
      )}

      <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint"><span className="h-px flex-1 bg-line" /><span>or</span><span className="h-px flex-1 bg-line" /></div>
      <button type="button" onClick={() => void continueWithGoogle()} disabled={googleLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong disabled:opacity-60"><GoogleIcon className="h-4 w-4" /> Continue with Google</button>
    </AuthShell>
  );
}
