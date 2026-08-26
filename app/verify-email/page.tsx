"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, LoaderCircle, Mail, RefreshCw } from "lucide-react";
import { useRouter } from "@/lib/routing";
import AuthShell from "@/components/auth/auth-shell";
import AuthLoadingScreen from "@/components/auth/auth-loading-screen";
import AuthField from "@/components/auth/auth-field";
import OtpInput from "@/components/auth/otp-input";
import { claimUsernameForCurrentUser, getAuthErrorMessage, sendEmailOtp, verifyEmailOtp } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { ready, status, user } = useAuth();
  const [email, setEmail] = useState(() => window.localStorage.getItem("vynq_pending_verification_email") ?? "");
  const [pendingUsername] = useState(() => window.localStorage.getItem("vynq_pending_username") ?? "");
  const [step, setStep] = useState<"email" | "code">(email ? "code" : "email");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (status === "authenticated") {
      setVerified(true);
      setMessage("Email verified successfully. Your private space is ready.");
      window.localStorage.removeItem("vynq_pending_verification_email");
      window.localStorage.removeItem("vynq_pending_username");
    }
    if (status === "signed-out" && !email) router.replace("/login");
  }, [email, ready, router, status]);

  const requestCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address to receive a code.");
      return;
    }
    setError("");
    setMessage("");
    setSending(true);
    try {
      await sendEmailOtp(email);
      window.localStorage.setItem("vynq_pending_verification_email", email.trim());
      setStep("code");
      setMessage("We sent a 6-digit code to your inbox. Check spam if it is missing.");
    } catch (sendError) {
      setError(getAuthErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code we sent.");
      return;
    }
    if (!email) {
      setError("We lost your email. Request a new code.");
      return;
    }
    setError("");
    setSending(true);
    try {
      const verifiedUser = await verifyEmailOtp(email, code);
      if (pendingUsername) {
        try {
          await claimUsernameForCurrentUser(pendingUsername, pendingUsername);
        } catch (claimError) {
          setError(getAuthErrorMessage(claimError));
        }
      }
      if (verifiedUser.emailVerified) {
        setVerified(true);
        setMessage("Email verified successfully. Your private space is ready.");
        window.localStorage.removeItem("vynq_pending_verification_email");
        window.localStorage.removeItem("vynq_pending_username");
      }
    } catch (verifyError) {
      setError(getAuthErrorMessage(verifyError));
    } finally {
      setSending(false);
    }
  };

  if (!ready || (status === "signed-out" && !email)) return <AuthLoadingScreen message="Preparing verification..." />;

  const continuePath = user ? "/home" : "/login";
  const continueLabel = user ? "Open Vynq-chat" : "Sign in to Vynq-chat";

  return (
    <AuthShell
      eyebrow="One last step"
      title={verified ? "Email verified." : step === "email" ? "Verify your email." : "Enter your code."}
      description="Vynq uses a one-time code to keep private spaces connected to real, reachable accounts."
      alternate={<button type="button" onClick={() => router.replace("/login")} className="font-bold text-brand-strong hover:underline">Use another account</button>}
    >
      {verified ? (
        <>
          <div className="rounded-[24px] border border-brand/10 bg-brand-pale p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-sm"><Check className="h-6 w-6" /></div>
            <p className="mt-5 text-[13px] font-bold text-ink">{email || "Your email address"}</p>
            <p className="mt-2 text-[12px] leading-5 text-ink-soft">The code was accepted. Continue when you are ready.</p>
          </div>
          <button type="button" onClick={() => router.replace(continuePath)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong"><Check className="h-4 w-4" /> {continueLabel}</button>
        </>
      ) : step === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <AuthField label="Email address" icon={Mail} value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
          {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
          {message ? <p role="status" className="rounded-2xl border border-success/25 bg-success-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-success">{message}</p> : null}
          <button disabled={sending} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong disabled:opacity-60">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <>Send code <Mail className="h-4 w-4" /></>}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="px-1 text-[12px] leading-5 text-ink-soft">We sent a 6-digit code to <span className="font-bold text-ink">{email}</span></p>
          <OtpInput value={code} onChange={setCode} disabled={sending} />
          {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
          {message ? <p role="status" className="rounded-2xl border border-success/25 bg-success-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-success">{message}</p> : null}
          <button disabled={sending || code.length < 6} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong disabled:opacity-60">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <>Verify <Check className="h-4 w-4" /></>}</button>
          <button type="button" disabled={sending} onClick={() => { setCode(""); void requestCode(); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong disabled:opacity-60"><RefreshCw className="h-4 w-4" /> Resend code</button>
        </form>
      )}

      <p className="mt-5 text-center text-[10px] leading-4 text-ink-faint">The code may take a minute. You can safely leave this tab open.</p>
    </AuthShell>
  );
}
