"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/routing";
import { ArrowLeft, Check, Clock3, LoaderCircle, LockKeyhole, UserCheck, UserPlus, UserRoundX, Users } from "lucide-react";
import { fetchProfileByUsername, fetchRelationship, getSocialErrorMessage, normalizeUsername, sendFollowRequest } from "@/lib/social/social-actions";
import type { RelationshipStatus, SocialProfile } from "@/lib/social/types";

const gradients = [
  "linear-gradient(135deg, #86b8fb, #6580d8)",
  "linear-gradient(135deg, #f3b29f, #a87ce0)",
  "linear-gradient(135deg, #74c9e7, #5b70c4)",
  "linear-gradient(135deg, #eeb87b, #d97887)",
];

function initials(profile: SocialProfile) {
  const parts = profile.displayName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : profile.username.slice(0, 2)).toUpperCase();
}

function background(profile: SocialProfile) {
  const score = profile.username.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return gradients[score % gradients.length];
}

export default function PublicProfilePage({ username, currentUid }: { username: string; currentUid: string }) {
  const normalized = useMemo(() => normalizeUsername(username), [username]);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus>("none");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const nextProfile = await fetchProfileByUsername(normalized);
        if (cancelled) return;
        setProfile(nextProfile);
        setRelationship(nextProfile ? await fetchRelationship(currentUid, nextProfile.uid) : "none");
      } catch (loadError) {
        if (!cancelled) setError(getSocialErrorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [currentUid, normalized]);

  const follow = async () => {
    if (!profile || relationship !== "none") return;
    setActionLoading(true);
    setError("");
    try {
      await sendFollowRequest(profile.uid);
      setRelationship("requested");
    } catch (followError) {
      setError(getSocialErrorMessage(followError));
    } finally {
      setActionLoading(false);
    }
  };

  const action = relationship === "self"
    ? <Link href="/home" className="inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong">Open my profile</Link>
    : relationship === "friends"
      ? <span className="inline-flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-[11px] font-bold text-success"><UserCheck className="h-4 w-4" /> Friends</span>
      : relationship === "requested"
        ? <span className="inline-flex items-center gap-2 rounded-2xl bg-brand-pale px-4 py-3 text-[11px] font-bold text-brand-strong"><Clock3 className="h-4 w-4" /> Request sent</span>
        : relationship === "incoming"
          ? <Link href="/home" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.22)] hover:bg-brand-strong"><Users className="h-4 w-4" /> Review in Profile</Link>
          : <button type="button" disabled={actionLoading} onClick={() => void follow()} className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.22)] hover:bg-brand-strong disabled:opacity-60">{actionLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Follow</button>;

  return (
    <main className="min-h-[100svh] bg-canvas px-4 py-4 text-ink sm:px-6 sm:py-7">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-3xl flex-col overflow-hidden rounded-[30px] border border-line bg-surface shadow-soft sm:min-h-[calc(100svh-3.5rem)]">
        <header className="flex items-center justify-between border-b border-line bg-white px-5 py-5 sm:px-8">
          <Link href="/home" className="inline-flex items-center gap-2 text-[11px] font-bold text-ink-soft hover:text-brand-strong"><ArrowLeft className="h-4 w-4" /> Back to Vynq</Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-brand"><LockKeyhole className="h-3.5 w-3.5" /> Private profile</span>
        </header>

        <div className="flex flex-1 items-center justify-center bg-surface-soft px-5 py-10 sm:px-10">
          {loading ? <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft"><LoaderCircle className="h-5 w-5 animate-spin text-brand" /> Opening profile…</div> : profile ? (
            <div className="w-full max-w-xl text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full p-1 ring-gradient"><div className="flex h-full w-full items-center justify-center rounded-full border-4 border-white text-2xl font-bold text-white shadow-float" style={{ background: background(profile) }}>{initials(profile)}</div></div>
              <p className="mt-6 text-2xl font-bold tracking-[-0.055em] text-ink sm:text-3xl">{profile.displayName}</p>
              <p className="mt-1 text-[13px] font-semibold text-brand-strong">@{profile.username}</p>
              <p className="mx-auto mt-4 max-w-md text-[13px] leading-5 text-ink-soft">{profile.bio || "Keeping conversations close and short-lived."}</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>
              {relationship === "self" ? <p className="mt-6 text-[11px] text-ink-faint">This is your profile. Use the Profile tab to manage requests and connections.</p> : <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-ink-faint"><Check className="h-3.5 w-3.5 text-success" /> Only accepted connections can start a chat.</p>}
            </div>
          ) : (
            <div className="max-w-sm text-center"><UserRoundX className="mx-auto h-8 w-8 text-ink-faint" /><p className="mt-4 text-lg font-bold text-ink">Profile not found</p><p className="mt-2 text-[12px] leading-5 text-ink-soft">{error || "This username may be private, unavailable, or spelled differently."}</p><Link href="/home" className="mt-5 inline-flex rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white hover:bg-brand-strong">Return home</Link></div>
          )}
        </div>

        <footer className="flex items-center justify-center gap-1.5 border-t border-line bg-white px-5 py-4 text-[10px] text-ink-faint"><Clock3 className="h-3 w-3" /> Connections and chats are designed to expire automatically.</footer>
      </div>
    </main>
  );
}
