"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleDashed, Clock3, Eye, Image as ImageIcon, LoaderCircle, LockKeyhole, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchSocialSnapshot } from "@/lib/social/social-actions";
import { getSeenStatusIds, getStatusErrorMessage, getStatusViewerCount, listenToStatusFeed, markStatusSeen } from "@/lib/status/status-actions";
import type { StoryStatus } from "@/lib/status/types";
import SecureStatusMedia from "@/components/secure-status-media";
import StatusComposer from "@/components/status-composer";
import { useModalFocus } from "@/lib/ui/use-modal-focus";

type StoryGroup = {
  ownerUid: string;
  ownerDisplayName: string;
  ownerUsername: string;
  statuses: StoryStatus[];
  latest: StoryStatus;
};

const AVATAR_BACKGROUNDS = [
  "linear-gradient(135deg, #c4ddff, #658ee8)",
  "linear-gradient(135deg, #a3ded3, #4c9fc7)",
  "linear-gradient(135deg, #f6c5a7, #da85b7)",
  "linear-gradient(135deg, #d7c6fb, #7b8ed8)",
  "linear-gradient(135deg, #f1db9d, #d59667)",
];

function initialLetters(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "V").toUpperCase();
}

function avatarBackground(seed: string) {
  const value = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_BACKGROUNDS[value % AVATAR_BACKGROUNDS.length];
}

function statusTime(timestamp: StoryStatus["createdAt"]) {
  if (!timestamp) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp.toMillis()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : "Yesterday";
}

function timeRemaining(timestamp: StoryStatus["expiresAt"]) {
  if (!timestamp) return "Expires in 24h";
  const minutes = Math.max(0, Math.ceil((timestamp.toMillis() - Date.now()) / 60_000));
  if (minutes < 60) return `Expires in ${minutes}m`;
  return `Expires in ${Math.ceil(minutes / 60)}h`;
}

function makeGroups(statuses: StoryStatus[]) {
  const byOwner = new Map<string, StoryGroup>();
  statuses.forEach((status) => {
    const existing = byOwner.get(status.ownerUid);
    if (existing) existing.statuses.push(status);
    else byOwner.set(status.ownerUid, {
      ownerUid: status.ownerUid,
      ownerDisplayName: status.ownerDisplayName,
      ownerUsername: status.ownerUsername,
      statuses: [status],
      latest: status,
    });
  });
  return Array.from(byOwner.values()).map((group) => {
    const ordered = [...group.statuses].sort((left, right) => (left.createdAt?.toMillis() ?? 0) - (right.createdAt?.toMillis() ?? 0));
    return { ...group, statuses: ordered, latest: ordered[ordered.length - 1] };
  }).sort((left, right) => (right.latest.createdAt?.toMillis() ?? 0) - (left.latest.createdAt?.toMillis() ?? 0));
}

function StoryAvatar({ group, seen, you = false }: { group: StoryGroup; seen: boolean; you?: boolean }) {
  return <span className={seen ? "rounded-full p-[3px] ring-1 ring-line" : "rounded-full p-[3px] ring-gradient"}>
    <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-white text-sm font-extrabold text-white shadow-sm" style={{ background: avatarBackground(group.ownerUsername) }}>
      {initialLetters(you ? "Your status" : group.ownerDisplayName)}
    </span>
  </span>;
}

function StoryViewer({ group, currentUid, onClose, onSeen }: { group: StoryGroup; currentUid: string; onClose: () => void; onSeen: (statusId: string) => void }) {
  const [index, setIndex] = useState(0);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const status = group.statuses[index];
  const isOwner = status?.ownerUid === currentUid;
  const dialogRef = useModalFocus(true, onClose);

  const previous = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);
  const next = useCallback(() => {
    if (index >= group.statuses.length - 1) onClose();
    else setIndex((current) => current + 1);
  }, [group.statuses.length, index, onClose]);

  useEffect(() => {
    if (!status) return;
    if (!isOwner) {
      void markStatusSeen(status.id, currentUid).then(() => onSeen(status.id)).catch(() => undefined);
      return;
    }
    void getStatusViewerCount(status.id).then(setViewerCount).catch(() => setViewerCount(null));
  }, [currentUid, isOwner, onSeen, status]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(next, status.type === "video" ? Math.max(5_000, Math.ceil((status.durationSeconds ?? 8) * 1_000)) : 5_000);
    return () => window.clearTimeout(timeout);
  }, [next, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, onClose, previous]);

  if (!status) return null;
  return <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${group.ownerDisplayName}'s status`} className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d1d36]/94 p-0 text-white sm:p-5">
    <div className="relative flex h-[100svh] w-full max-w-[560px] flex-col overflow-hidden bg-[#132441] shadow-[0_30px_100px_rgba(0,0,0,0.48)] sm:h-[min(820px,calc(100svh-2.5rem))] sm:rounded-[30px]">
      <div className="absolute inset-x-0 top-0 z-20 p-4 sm:p-5">
        <div className="flex gap-1.5">{group.statuses.map((item, itemIndex) => <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"><span className={`block h-full bg-white transition-transform duration-200 ${itemIndex < index ? "translate-x-0" : itemIndex === index ? "translate-x-0" : "-translate-x-full"}`} /></span>)}</div>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/35 text-[11px] font-extrabold text-white" style={{ background: avatarBackground(group.ownerUsername) }}>{initialLetters(group.ownerDisplayName)}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold">{group.ownerDisplayName}</p><p className="mt-0.5 text-[10px] text-white/70">@{group.ownerUsername} &middot; {statusTime(status.createdAt)}</p></div>
          {isOwner ? <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1.5 text-[10px] font-semibold text-white/90"><Eye className="h-3.5 w-3.5" /> {viewerCount ?? "..."}</span> : null}
          <button type="button" onClick={onClose} aria-label="Close status viewer" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1"><SecureStatusMedia key={status.id} status={status} variant="viewer" autoPlay /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#091528]/60 to-transparent" /></div>
      <button type="button" onClick={previous} disabled={index === 0} aria-label="Previous status" className="absolute inset-y-0 left-0 z-10 w-[24%] disabled:cursor-default" />
      <button type="button" onClick={next} aria-label="Next status" className="absolute inset-y-0 right-0 z-10 w-[24%]" />
      <div className="absolute bottom-5 left-5 z-20 rounded-full bg-black/20 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">{timeRemaining(status.expiresAt)}</div>
      <div className="pointer-events-none absolute inset-y-0 left-2 z-20 flex items-center sm:left-4"><span className="rounded-full bg-black/20 p-1.5 text-white/80"><ChevronLeft className="h-4 w-4" /></span></div>
      <div className="pointer-events-none absolute inset-y-0 right-2 z-20 flex items-center sm:right-4"><span className="rounded-full bg-black/20 p-1.5 text-white/80"><ChevronRight className="h-4 w-4" /></span></div>
    </div>
  </div>;
}

export default function StatusPanel() {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<StoryStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerGroup, setViewerGroup] = useState<StoryGroup | null>(null);
  const [seenStatusIds, setSeenStatusIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    let active = true;
    let stopFeed: () => void = () => {};
    void fetchSocialSnapshot(user.uid)
      .then((snapshot) => {
        if (!active) return;
        stopFeed = listenToStatusFeed([user.uid, ...snapshot.friends.map((friend) => friend.uid)], (nextStatuses) => {
          if (!active) return;
          setStatuses(nextStatuses);
          setLoading(false);
          void getSeenStatusIds(nextStatuses.map((status) => status.id), user.uid)
            .then((seenIds) => { if (active) setSeenStatusIds(seenIds); })
            .catch(() => undefined);
        }, (feedError) => {
          if (!active) return;
          setError(getStatusErrorMessage(feedError));
          setLoading(false);
        });
      })
      .catch((socialError) => {
        if (!active) return;
        setError(getStatusErrorMessage(socialError));
        setLoading(false);
      });
    return () => {
      active = false;
      stopFeed();
    };
  }, [user]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  const liveGroups = useMemo(() => makeGroups(statuses.filter((status) => !status.expiresAt || status.expiresAt.toMillis() > now)), [now, statuses]);
  const ownGroup = liveGroups.find((group) => group.ownerUid === user?.uid) ?? null;
  const friendGroups = liveGroups.filter((group) => group.ownerUid !== user?.uid);
  const openGroup = (group: StoryGroup) => setViewerGroup(group);
  const registerSeen = useCallback((statusId: string) => {
    setSeenStatusIds((current) => current.has(statusId) ? current : new Set(current).add(statusId));
  }, []);

  return <section className="flex min-h-0 flex-1 flex-col bg-surface-soft">
    <header className="shrink-0 border-b border-line bg-white px-5 py-5 md:px-10 md:py-7"><div className="mx-auto flex max-w-6xl items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-brand"><CircleDashed className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Share a moment</span></div><h1 className="mt-2 text-[25px] font-bold tracking-[-0.055em] text-ink md:text-[30px]">Status</h1><p className="mt-1 max-w-xl text-[11px] leading-5 text-ink-soft">Friends-only images and short videos that disappear 24 hours after sharing.</p></div><button type="button" onClick={() => { setError(""); setComposerOpen(true); }} className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-brand px-3.5 py-3 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(92,141,246,0.24)] transition hover:bg-brand-strong"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">New status</span></button></div></header>
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-10 md:py-9"><div className="mx-auto max-w-6xl">
      {error ? <p role="alert" className="mb-5 rounded-2xl border border-[#f3c7c7] bg-[#fff5f5] px-4 py-3 text-[11px] font-semibold leading-5 text-[#b74d56]">{error}</p> : null}
      <div className="rounded-[26px] border border-line bg-white p-4 shadow-[0_8px_24px_rgba(75,112,159,0.05)] sm:p-5"><div className="no-scrollbar flex gap-4 overflow-x-auto pb-1 sm:gap-5"><button type="button" onClick={() => { setError(""); setComposerOpen(true); }} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center"><span className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-dashed border-brand/55 bg-brand-pale transition group-hover:border-brand group-hover:bg-brand-soft"><Plus className="h-5 w-5 text-brand" /><span className="absolute -bottom-1 rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-bold text-white">Add</span></span><span className="truncate text-[10px] font-bold text-ink">Your status</span></button>{ownGroup ? <button type="button" onClick={() => openGroup(ownGroup)} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center"><StoryAvatar group={ownGroup} seen you /><span className="truncate text-[10px] font-bold text-ink">My story</span></button> : null}{friendGroups.map((group) => { const seen = group.statuses.every((status) => seenStatusIds.has(status.id)); return <button key={group.ownerUid} type="button" onClick={() => openGroup(group)} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"><span className="transition duration-200 group-hover:scale-105"><StoryAvatar group={group} seen={seen} /></span><span className="w-full truncate text-[10px] font-bold text-ink">{group.ownerDisplayName.split(" ")[0]}</span></button>; })}</div></div>
      <div className="mt-9 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-ink-faint">Latest from friends</p><p className="mt-1 text-[11px] text-ink-soft">A blue ring marks something you have not seen.</p></div><span className="hidden items-center gap-1.5 text-[10px] font-semibold text-ink-faint sm:flex"><Clock3 className="h-3.5 w-3.5" /> 24h lifetime</span></div>
      {loading ? <div className="mt-4 flex min-h-48 items-center justify-center rounded-[26px] border border-line bg-white text-[11px] font-semibold text-ink-soft"><LoaderCircle className="mr-2 h-4 w-4 animate-spin text-brand" /> Loading private updates</div> : friendGroups.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{friendGroups.map((group) => { const seen = group.statuses.every((status) => seenStatusIds.has(status.id)); return <button key={group.ownerUid} type="button" onClick={() => openGroup(group)} className="group relative min-h-60 overflow-hidden rounded-[26px] bg-ink text-left shadow-[0_12px_30px_rgba(65,100,150,0.14)] transition duration-300 hover:-translate-y-1 hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"><div className="absolute inset-0 transition duration-500 group-hover:scale-[1.03]"><SecureStatusMedia status={group.latest} /></div><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b1b33]/88 via-[#0b1b33]/8 to-[#0b1b33]/26" /><div className="absolute left-4 top-4 flex items-center gap-2.5"><StoryAvatar group={group} seen={seen} /><div><p className="text-[12px] font-bold text-white">{group.ownerDisplayName}</p><p className="mt-0.5 text-[10px] text-white/72">@{group.ownerUsername} &middot; {statusTime(group.latest.createdAt)}</p></div></div><div className="absolute bottom-4 left-4 right-4 flex items-end justify-between"><span className="rounded-full bg-white/15 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm">{group.statuses.length > 1 ? `${group.statuses.length} moments` : group.latest.type === "video" ? "Video" : "Image"}</span><span className="rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-brand-strong">View</span></div></button>; })}</div> : <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]"><div className="rounded-[26px] border border-dashed border-brand/25 bg-white px-6 py-12 text-center"><CircleDashed className="mx-auto h-8 w-8 text-brand" /><p className="mt-4 text-[14px] font-bold text-ink">No friend updates yet</p><p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-ink-soft">Accepted friends&apos; moments will appear here. Share a private status to start the conversation.</p><button type="button" onClick={() => { setError(""); setComposerOpen(true); }} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-pale px-3.5 py-2.5 text-[11px] font-bold text-brand-strong hover:bg-brand-soft"><ImageIcon className="h-4 w-4" /> Share a status</button></div><div className="rounded-[26px] border border-brand/10 bg-brand-pale p-6"><LockKeyhole className="h-5 w-5 text-brand" /><p className="mt-4 text-[13px] font-bold text-ink">Private by default</p><p className="mt-2 text-[11px] leading-5 text-ink-soft">Only accepted friends can load a status or its media. Expired files are removed with the status record.</p></div></div>}
      {ownGroup ? <div className="mt-7 rounded-[24px] border border-line bg-white p-4 sm:flex sm:items-center sm:gap-4 sm:p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-pale text-brand"><Eye className="h-5 w-5" /></span><div className="mt-3 min-w-0 sm:mt-0"><p className="text-[12px] font-bold text-ink">Your active status</p><p className="mt-1 text-[11px] text-ink-soft">{ownGroup.statuses.length} {ownGroup.statuses.length === 1 ? "moment" : "moments"} live &middot; {timeRemaining(ownGroup.latest.expiresAt)}</p></div><button type="button" onClick={() => openGroup(ownGroup)} className="mt-4 rounded-xl border border-line px-3 py-2 text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong sm:ml-auto sm:mt-0">View insights</button></div> : null}
    </div></div>
    <StatusComposer open={composerOpen} onClose={() => setComposerOpen(false)} onShared={() => { setComposerOpen(false); setError(""); }} onError={setError} error={error} />
    {viewerGroup && user ? <StoryViewer key={viewerGroup.ownerUid} group={viewerGroup} currentUid={user.uid} onClose={() => setViewerGroup(null)} onSeen={registerSeen} /> : null}
  </section>;
}
