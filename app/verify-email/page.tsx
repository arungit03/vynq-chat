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
  const [linkVerified, setLinkVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const appliedRef = useRef(false);
  const hasCode = typeof window !== "undefined" && Boolean(extractActionCode(window.location.search));

  // A Firebase email link contains mode=verifyEmail and a one-time oobCode.
  // Consume it even when the link opens in a fresh, signed-out browser tab.
  useEffect(() => {
    const code = extractActionCode(window.location.search);
    if (!code) return;

    if (appliedRef.current) return;
    appliedRef.current = true;

    let active = true;
    void (async () => {
      setApplying(true);
      setError("");
      setMessage("");
      try {
        const email = await applyEmailVerificationCode(code);
        const refreshedUser = await refreshUser();
        if (!active) return;

        setVerifiedEmail(email);
        setLinkVerified(true);
        // Do not leave a reusable one-time code in the address bar or let the
        // browser/Firebase handler close the page unexpectedly.
        window.history.replaceState(null, "", "/verify-email");

        if (refreshedUser?.emailVerified) {
          setMessage("Email verified successfully. Your private space is ready.");
        } else {
          setMessage("Email verified successfully. Sign in to continue.");
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
  }, [refreshUser]);

  useEffect(() => {
    if (!ready || linkVerified) return;
    // Hold this page while Firebase is consuming an incoming verification
    // code. Redirecting here was the source of the previous auto-close.
    if (hasCode) return;
    if (status === "signed-out") router.replace("/login");
    if (status === "authenticated") router.replace("/home");
  }, [hasCode, linkVerified, ready, router, status]);

  const resend = async () => {
    if (!user) return;
    setSending(true);
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
        setLinkVerified(true);
        setMessage("Email verified successfully. Your private space is ready.");
      } else {
        setError("We do not see the verification yet. Open the email link, then try again.");
      }
    } catch (checkError) {
      setError(getAuthErrorMessage(checkError));
    } finally {
      setChecking(false);
    }
  };

  if (!ready || (!hasCode && status === "signed-out")) {
    return <AuthLoadingScreen message="Preparing verification..." />;
  }

  const continuePath = user ? "/home" : "/login";
  const continueLabel = user ? "Open Vynq-chat" : "Sign in to Vynq-chat";

  return (
    <AuthShell
      eyebrow="One last step"
      title={linkVerified ? "Email verified." : "Verify your email."}
      description="Vynq uses verification to keep private spaces connected to real, reachable accounts."
      alternate={<button type="button" onClick={() => void signOutUser()} className="font-bold text-brand-strong hover:underline">Use another account</button>}
    >
      <div className="rounded-[24px] border border-brand/10 bg-brand-pale p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-sm"><MailCheck className="h-6 w-6" /></div>
        <p className="mt-5 text-[13px] font-bold text-ink">{linkVerified ? (verifiedEmail ?? user?.email ?? "Your email address") : `Check ${user?.email ?? "your inbox"}`}</p>
        <p className="mt-2 text-[12px] leading-5 text-ink-soft">{linkVerified ? "The verification link was accepted. Continue when you are ready; this page will stay open." : "Tap the verification link in the email from Vynq. This page will stay open while you verify."}</p>
      </div>

      {applying ? <p role="status" className="mt-4 flex items-center gap-2 rounded-2xl border border-[#dbe7ff] bg-[#f1f6ff] px-3.5 py-3 text-[11px] font-semibold leading-4 text-brand-strong"><LoaderCircle className="h-4 w-4 animate-spin" /> Confirming your verification link...</p> : null}
      {message ? <p role="status" className="mt-4 rounded-2xl border border-success/25 bg-success-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-success">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}

      {linkVerified ? (
        <button type="button" onClick={() => router.replace(continuePath)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong"><Check className="h-4 w-4" /> {continueLabel}</button>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button disabled={checking || applying || !user} type="button" onClick={() => void checkVerification()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.2)] hover:bg-brand-strong disabled:opacity-60">{checking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} I verified</button>
          <button disabled={sending || applying || !user} type="button" onClick={() => void resend()} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong disabled:opacity-60">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Resend email</button>
        </div>
      )}

      <p className="mt-5 text-center text-[10px] leading-4 text-ink-faint">The email link may take a minute. You can safely leave this tab open.</p>
    </AuthShell>
  );
}
