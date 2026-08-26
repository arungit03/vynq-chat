"use client";

import { FormEvent, useEffect, useState } from "react";
import { AtSign, ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "@/lib/routing";
import AuthField from "@/components/auth/auth-field";
import AuthLoadingScreen from "@/components/auth/auth-loading-screen";
import AuthShell from "@/components/auth/auth-shell";
import { claimUsernameForCurrentUser, getAuthErrorMessage, normalizeUsername, suggestedUsernameForUser, validateUsername } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchProfileByUid } from "@/lib/social/social-actions";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { ready, status, user, completingOAuth, signOutUser } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || completingOAuth) return;
    if (status === "signed-out") router.replace("/login");
    if (status === "unverified") router.replace("/verify-email");
    if (status === "authenticated" && user) {
      void fetchProfileByUid(user.uid).then((profile) => {
        if (profile?.username) router.replace("/home");
      }).catch(() => undefined);
    }
  }, [ready, router, status, user, completingOAuth]);

  if (!ready || !user || status !== "authenticated") {
    return <AuthLoadingScreen message="Preparing your profile..." />;
  }

  const usernameError = username ? validateUsername(username) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUsername = normalizeUsername(username);
    const validationError = validateUsername(cleanUsername);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    try {
      await claimUsernameForCurrentUser(cleanUsername, user.displayName ?? cleanUsername);
      router.replace("/home");
    } catch (claimError) {
      setError(getAuthErrorMessage(claimError));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Make it yours"
      title="Choose your username."
      description="Your Google account is connected. Pick the unique name people will use to find you on Vynq."
      alternate={<button type="button" onClick={() => void signOutUser()} className="font-bold text-brand-strong hover:underline">Use another account</button>}
    >
      <div className="rounded-[24px] border border-brand/10 bg-brand-pale p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">Signed in with Google</p>
        <p className="mt-3 text-[13px] font-bold text-ink">{user.email}</p>
        <p className="mt-1 text-[11px] leading-4 text-ink-soft">Your email stays private. Only your chosen username is searchable.</p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <AuthField label="Username" icon={AtSign} value={username} onChange={(value) => setUsername(value.replace(/\s/g, ""))} placeholder={suggestedUsernameForUser(user)} autoComplete="username" hint={usernameError ? <span className="text-danger">{usernameError}</span> : "unique"} />
        <p className="-mt-1 px-1 text-[10px] leading-4 text-ink-faint">3–24 characters · lowercase letters, numbers, periods, or underscores</p>
        {error ? <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[11px] font-semibold leading-4 text-danger">{error}</p> : null}
        <button disabled={loading} type="submit" className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[12px] font-bold text-white shadow-[0_12px_24px_rgba(92,141,246,0.24)] transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />} {loading ? "Saving your username..." : "Continue to Vynq"}</button>
      </form>
    </AuthShell>
  );
}
