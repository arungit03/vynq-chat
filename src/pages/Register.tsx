import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AtSign, Mail, Lock, Check, Loader2, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { registerWithEmail, sendVerificationEmail } from "@/services/auth";
import { isUsernameAvailable, createProfile } from "@/services/profile";
import { friendlyError } from "@/lib/errorMap";
import { validateUsername, validateEmail, validatePassword, normalizeUsername } from "@/lib/validation";
import { LIMITS } from "@/lib/constants";

type Step = "username" | "credentials";

export default function Register() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("username");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function checkUsername(forceValue?: string) {
    const value = forceValue ?? username;
    const v = validateUsername(value);
    if (!v.ok) {
      setUsernameStatus("invalid");
      setError(v.error!);
      return false;
    }
    setError("");
    setUsernameStatus("checking");
    try {
      const available = await isUsernameAvailable(value);
      if (available) {
        setUsernameStatus("available");
        return true;
      } else {
        setUsernameStatus("taken");
        setError("That username is already taken.");
        return false;
      }
    } catch (err) {
      setUsernameStatus("idle");
      setError(friendlyError(err));
      return false;
    }
  }

  async function handleUsernameNext(e: FormEvent) {
    e.preventDefault();
    const ok = await checkUsername();
    if (ok) setStep("credentials");
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    // Re-verify username uniqueness at submit time (race protection).
    const u = validateUsername(username);
    if (!u.ok) return setError(u.error!);
    const ev = validateEmail(email);
    if (!ev.ok) return setError(ev.error!);
    const pv = validatePassword(password);
    if (!pv.ok) return setError(pv.error!);

    const stillAvailable = await isUsernameAvailable(username);
    if (!stillAvailable) {
      setUsernameStatus("taken");
      setError("That username was just taken. Try another.");
      setStep("username");
      return;
    }

    setLoading(true);
    try {
      const user = await registerWithEmail(email.trim(), password);
      await createProfile({
        uid: user.uid,
        email: user.email ?? email.trim(),
        username: username.trim(),
        displayName: username.trim(),
      });
      await sendVerificationEmail(user);
      toast("Account created. Please verify your email.", "success");
      navigate("/verify-email", { replace: true });
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
          <h1 className="text-2xl font-bold text-ink">
            {step === "username" ? "Choose a username" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {step === "username"
              ? "This is how friends find you on Vynq."
              : "Just one password — we'll keep it simple."}
          </p>
        </div>

        <div className="mb-5 flex items-center justify-center gap-2 text-xs">
          <StepDot active={step === "username"} done={step === "credentials"} label="1. Username" />
          <span className="h-px w-6 bg-brand-200" />
          <StepDot active={step === "credentials"} label="2. Account" />
        </div>

        <form onSubmit={step === "username" ? handleUsernameNext : handleRegister} className="card space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-danger">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "username" ? (
            <div>
              <Input
                label="Username"
                placeholder="arun"
                leftIcon={<AtSign size={18} />}
                value={username}
                maxLength={LIMITS.USERNAME_MAX}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/\s/g, ""));
                  setUsernameStatus("idle");
                  setError("");
                }}
                onBlur={() => username && checkUsername()}
                autoFocus
                required
              />
              <div className="mt-1.5 flex h-5 items-center gap-1.5 text-sm">
                {usernameStatus === "checking" && (
                  <span className="flex items-center gap-1 text-ink-muted">
                    <Loader2 size={14} className="animate-spin" /> Checking availability…
                  </span>
                )}
                {usernameStatus === "available" && (
                  <span className="flex items-center gap-1 text-success">
                    <Check size={14} /> @{normalizeUsername(username)} is available
                  </span>
                )}
                {usernameStatus === "taken" && (
                  <span className="flex items-center gap-1 text-danger">
                    <X size={14} /> Taken
                  </span>
                )}
                {usernameStatus === "invalid" && <span className="text-danger">Enter 3–20 letters, numbers, or _</span>}
                {usernameStatus === "idle" && (
                  <span className="text-ink-muted">3–20 chars: letters, numbers, underscores.</span>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
                Signing up as <span className="font-semibold">@{normalizeUsername(username)}</span>
              </div>
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
                autoComplete="new-password"
                placeholder="At least 8 characters"
                leftIcon={<Lock size={18} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-ink-muted">
                One password is all you need. We'll email you a verification link.
              </p>
            </>
          )}

          {step === "username" ? (
            <Button type="submit" fullWidth loading={usernameStatus === "checking"}>
              Continue
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep("username")} disabled={loading}>
                Back
              </Button>
              <Button type="submit" fullWidth loading={loading}>
                Create account
              </Button>
            </div>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done?: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${active ? "text-brand-700" : "text-ink-muted"}`}>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
          done ? "bg-success text-white" : active ? "bg-brand-600 text-white" : "bg-brand-100 text-ink-muted"
        }`}
      >
        {done ? <Check size={12} /> : label[0]}
      </span>
      {label}
    </span>
  );
}
