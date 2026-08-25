"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MailCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import AuthLoadingScreen from "@/components/auth/auth-loading-screen";
import { applyEmailVerificationCode, extractActionCode, getAuthErrorMessage, resendVerificationEmail } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { ready, status, user, refreshUser, signOutUser } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const appliedRef = useRef(false);

  // Read the verification code once per mount. While a code is present the page
  // must stay open and apply it rather than bouncing to /login on a transient
  // signed-out state (which is what caused the page to auto-close).
  const hasCode = typeof window !== "undefined" && Boolean(extractActionCode(window.location.search));

  // Consume the verification link whenever it carries an email-action code.
  useEffect(() => {
    if (!hasCode) return;
    const code = extractActionCode(window.location.search);
    if (!code || appliedRef.current) return;
    if (!user) {
      // Session not restored yet. Stay on the page; the effect re-runs once the
      // user is available. Do not redirect away.
      return;
    }

    appliedRef.current = true;
    let active = true;
    void (async () => {
      setApplying(true);
      setError("");
      setMessage("");
      try {
        await applyEmailVerificationCode(code);
        const refreshedUser = await refreshUser();
        if (active && refreshedUser?.emailVerified) {
          setMessage("Email verified. Opening Vynq-chat…");
          router.replace("/home");
        } else if (active) {
          setError("We could not confirm the verification. Try again or request a new link.");
        }
      } catch (applyError) {
        if (active) setError(getAuthErrorMessage(applyError));
      } finally {
        if (active) setApplying(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCode, user]);

  useEffect(() => {
    if (!ready) return;
    if (status === "signed-out") {
      if (hasCode) return; // Stay open; guidance is shown from state set below.
      router.replace("/login");
      return;
    }
    if (status === "authenticated") router.replace("/home");
  }, [ready, router, status, hasCode]);

  // When a verification link arrives for an account that is not the one signed
  // in, show guidance without redirecting away (which caused the auto-close).
  const showCodeAccountHint = ready && status === "signed-out" && hasCode && !error;

  // Show the loading screen only when we are not deliberately holding the page
  // open for an incoming verification code.
  if (!ready || (status === "signed-out" && !hasCode)) return <AuthLoadingScreen message="Preparing verification…" />;

  const resend = async () => {
    if (!user) return;
    setError("");
    setMessage("");
    try {
      await resendVerificationEmail(user);
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (sendError) {
      setError(getAuthErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  };

  const checkVerification = async () => {
    setChecking(true);
    setError("");
    try {
      const refreshedUser = await refreshUser();
      if (refreshedUser?.emailVerified) {
        setMessage("Email verified. Opening Vynq-chat…");
        router.replace("/home");
      } else {
        setError("We do not see the verification yet. Open the email link, then try again.");
      }
    } catch (checkError) {
      setError(getAuthErrorMessage(checkError));
    } finally {
      setChecking(false);
    }
  };

  if (showCodeAccountHint) {
    return (
      <AuthShell eyebrow="One last step" title="Verify your email." description="Vynq uses verification to keep private spaces connected to real, reachable accounts." alternate={<button type="button" onClick={() => router.replace("/login")} className="font-bold text-brand-strong hover:underline">Sign in</button>}>
        <div className="rounded-[24px] border border-danger/25 bg-danger-soft p-5"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-danger shadow-sm"><MailCheck className="h-6 w-6" /></div><p className="mt-5 text-[13px] font-bold text-ink">Sign in to verify</p><p className="mt-2 text-[12px] leading-5 text-ink-soft">This verification link belongs to a specific account. Sign in to that account, then open the link again from the same device.</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => router.replace("/login")} className="flex h-12 items-center justify-center rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong">Sign in</button><button type="button" onClick={() => signOutUser()} className="flex h-12 items-center justify-center rounded-2xl border border-line bg-white text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong">Use another account</button></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="One last step" title="Verify your email." description="Vynq uses verification to keep private spaces connected to real, reachable accounts." alternate={<button type="button" onClick={() => signOutUser()} className="font-bold text-brand-strong hover:underline">Use another account</button>}>
      <div className="rounded-[24px] border border-brand/10 bg-brand-pale p-5"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-sm"><MailCheck className="h-6 w-6" /></div><p className="mt-5 text-[13px] font-bold text-ink">Check {user?.email}</p><p className="mt-2 text-[12px] leading-5 text-ink-soft">Tap the verification link in the email from Vynq. This page will stay open while you verify.</p></div>
      {applying ? <p role="status" className="mt-4 flex items-center gap-2 rounded-2xl border border-[#dbe7ff] bg-[#f1f6ff] px-3.5 py-3 text-[11px] font-semibold leading-4 text-brand-strong"><LoaderCircle className="h-4 w-4 animate-spin" /> Confirming your verification link…</p> : null}
      {message ? <p role="status" className="mt-4 rounded-2xl border border-success/25 bg-success-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-success">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><button disabled={checking || applying} type="button" onClick={checkVerification} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong disabled:opacity-60">{checking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} I verified</button><button disabled={sending || applying} type="button" onClick={resend} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong disabled:opacity-60">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Resend email</button></div>
      <p className="mt-5 text-center text-[10px] leading-4 text-ink-faint">The email link may take a minute. You can safely leave this tab open.</p>
    </AuthShell>
  );
}
