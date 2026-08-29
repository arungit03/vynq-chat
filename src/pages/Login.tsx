import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { loginWithEmail, resetPassword, sendVerificationEmail } from "@/services/auth";
import { friendlyError } from "@/lib/errorMap";
import { validateEmail } from "@/lib/validation";

export default function Login() {
  const { firebaseUser, emailVerified } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  // Already signed in + verified -> bounce home.
  if (firebaseUser && emailVerified) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const v = validateEmail(email);
    if (!v.ok) {
      setError(v.error!);
      return;
    }
    setLoading(true);
    try {
      const user = await loginWithEmail(email.trim(), password);
      if (!user.emailVerified) {
        // Existing unverified accounts may never have received the original
        // link, so request a fresh one when they sign in again.
        try {
          await sendVerificationEmail(user);
        } catch (err) {
          toast(friendlyError(err), "error");
        }
        navigate("/verify-email", { replace: true });
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setError("");
    const v = validateEmail(email);
    if (!v.ok) {
      setError(v.error!);
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      toast("Password reset email sent. Check your inbox.", "success");
      setResetMode(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to continue to Vynq</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-danger">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            leftIcon={<Mail size={18} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            leftIcon={<Lock size={18} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            onClick={() => setResetMode(true)}
            className="ml-auto block text-sm font-medium text-brand-600 hover:underline"
          >
            Forgot password?
          </button>

          <Button type="submit" fullWidth loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted">
          New to Vynq?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>

        {resetMode && (
          <div className="card mt-4 space-y-3 p-5">
            <p className="text-sm text-ink-soft">Enter your email to receive a reset link.</p>
            <Button onClick={handleReset} loading={loading} fullWidth>
              Send reset email
            </Button>
            <button onClick={() => setResetMode(false)} className="block w-full text-center text-sm text-ink-muted hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
