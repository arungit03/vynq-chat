import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { MailCheck, RefreshCw, LogOut, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { sendVerificationEmail, logout } from "@/services/auth";
import { friendlyError } from "@/lib/errorMap";
import { updateProfile } from "@/services/profile";

export default function VerifyEmail() {
  const { firebaseUser, refreshProfile, refreshEmailVerification } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastSent, setLastSent] = useState(0);
  const verificationCheckInFlight = useRef(false);

  const completeVerification = useCallback(async (showNotVerifiedMessage: boolean) => {
    if (!firebaseUser || verificationCheckInFlight.current) return false;

    verificationCheckInFlight.current = true;
    setChecking(true);
    try {
      const verified = await refreshEmailVerification();
      if (verified) {
        await updateProfile(firebaseUser.uid, { emailVerified: true });
        await refreshProfile();
        toast("Email verified! Redirecting...", "success");
        navigate("/home", { replace: true });
        return true;
      }
      if (showNotVerifiedMessage) {
        toast("Not verified yet. Open the link in your email first.", "info");
      }
    } catch (err) {
      if (showNotVerifiedMessage) toast(friendlyError(err), "error");
    } finally {
      verificationCheckInFlight.current = false;
      setChecking(false);
    }
    return false;
  }, [firebaseUser, navigate, refreshEmailVerification, refreshProfile, toast]);

  useEffect(() => {
    if (!firebaseUser) return;

    // The verification link is usually opened in another tab or mail app.
    // Re-check automatically when the user comes back to Vynq, so there is no
    // need to press a refresh button after verifying.
    const checkOnReturn = () => {
      if (document.visibilityState === "visible") {
        void completeVerification(false);
      }
    };

    void completeVerification(false);
    window.addEventListener("focus", checkOnReturn);
    document.addEventListener("visibilitychange", checkOnReturn);

    return () => {
      window.removeEventListener("focus", checkOnReturn);
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, [completeVerification, firebaseUser]);

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  async function resend() {
    const now = Date.now();
    if (now - lastSent < 30_000) {
      toast("Please wait a moment before resending.", "info");
      return;
    }
    setSending(true);
    try {
      await sendVerificationEmail(firebaseUser!);
      setLastSent(now);
      toast("Verification email sent. Check your inbox.", "success");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSending(false);
    }
  }

  async function check() {
    await completeVerification(true);
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-100 text-brand-600">
          <MailCheck size={32} />
        </div>
        <h1 className="text-2xl font-bold text-ink">Verify your email</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          We sent a verification link to <span className="font-medium text-ink">{firebaseUser.email}</span>. After you click
          it, we&apos;ll detect the verification automatically and sign you in.
        </p>

        <div className="card mt-6 space-y-3 p-6">
          <div className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-left text-sm text-brand-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>Messages auto-delete after 7 days. Status after 24 hours. Less digital baggage.</span>
          </div>

          <Button onClick={check} variant="outline" fullWidth loading={checking}>
            <RefreshCw size={16} /> Check manually
          </Button>
          <Button onClick={resend} variant="outline" fullWidth loading={sending}>
            Resend verification email
          </Button>
          <Button onClick={handleLogout} variant="ghost" fullWidth>
            <LogOut size={16} /> Logout
          </Button>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
          <AlertCircle size={13} /> Didn&apos;t get it? Check spam or resend above.
        </p>
      </div>
    </div>
  );
}
