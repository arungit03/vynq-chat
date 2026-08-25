"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  CircleDashed,
  Clock3,
  Ellipsis,
  Home,
  Image as ImageIcon,
  Info,
  LockKeyhole,
  LogOut,
  LoaderCircle,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smile,
  UserCheck,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { statuses, type Conversation, type Message } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth/auth-provider";
import PwaInstallCard from "@/components/pwa-install-card";
import NotificationPermission from "@/components/notification-permission";
import RealtimeChatPanel from "@/components/realtime-chat-panel";
import LiveStatusPanel from "@/components/status-panel";
import {
  formatChatTime,
  listenToConversationMeta,
  startPresence,
} from "@/lib/chat/chat-actions";
import type { ConversationMeta } from "@/lib/chat/types";
import {
  fetchProfileByUsername,
  fetchRelationship,
  fetchSocialSnapshot,
  getSocialErrorMessage,
  normalizeUsername,
  respondToFollowRequest,
  sendFollowRequest,
} from "@/lib/social/social-actions";
import type { RelationshipStatus, SocialFriend, SocialProfile, SocialSnapshot } from "@/lib/social/types";

type NavKey = "home" | "search" | "status" | "profile";

type AvatarProps = {
  initials: string;
  background: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  ring?: boolean;
};

const navItems: Array<{ id: NavKey; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "status", label: "Status", icon: CircleDashed },
  { id: "profile", label: "Profile", icon: UserRound },
];

const avatarSizes = {
  xs: "h-7 w-7 text-[9px]",
  sm: "h-9 w-9 text-[10px]",
  md: "h-11 w-11 text-[11px]",
  lg: "h-14 w-14 text-sm",
  xl: "h-20 w-20 text-lg",
};

function Avatar({ initials, background, size = "md", online, ring }: AvatarProps) {
  return (
    <div className={ring ? "rounded-full p-[2px] ring-gradient" : "relative"}>
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.04em] text-white ${avatarSizes[size]} ${ring ? "border-2 border-white" : ""}`}
        style={{ background }}
      >
        {initials}
        {online ? (
          <span className="presence-pulse absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success" />
        ) : null}
      </div>
    </div>
  );
}

const socialAvatarGradients = [
  "linear-gradient(135deg, #86b8fb, #6580d8)",
  "linear-gradient(135deg, #f3b29f, #a87ce0)",
  "linear-gradient(135deg, #74c9e7, #5b70c4)",
  "linear-gradient(135deg, #eeb87b, #d97887)",
  "linear-gradient(135deg, #8ed4bc, #6a9ed8)",
];

function profileInitials(profile: Pick<SocialProfile, "displayName" | "username">) {
  const source = profile.displayName.trim() || profile.username;
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function profileAvatar(profile: Pick<SocialProfile, "username">) {
  const score = profile.username.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return socialAvatarGradients[score % socialAvatarGradients.length];
}

function conversationForFriend(friend: SocialFriend, meta?: ConversationMeta): Conversation {
  return {
    id: friend.friendshipId,
    peerUid: friend.uid,
    name: friend.displayName,
    handle: `@${friend.username}`,
    initials: profileInitials(friend),
    avatar: profileAvatar(friend),
    online: false,
    lastMessage: meta?.lastMessagePreview || "Start a private conversation.",
    lastTime: meta?.lastMessageAt ? formatChatTime(meta.lastMessageAt) : "New",
    expiry: "24h",
    messages: [],
  };
}

function IconButton({
  label,
  children,
  onClick,
  className = "",
  active = false,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl transition hover:-translate-y-0.5 hover:bg-brand-pale hover:text-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-brand-soft text-brand-strong" : "text-ink-soft"} ${className}`}
    >
      {children}
    </button>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? "gap-0" : "gap-2.5"}`}>
      <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand text-white shadow-[0_8px_18px_rgba(92,141,246,0.28)]">
        <MessageCircle className="h-5 w-5 fill-white/95 stroke-brand" strokeWidth={2.4} />
        <span className="absolute bottom-[9px] left-[13px] h-1.5 w-1.5 rounded-full bg-brand" />
      </div>
      {!compact ? (
        <div>
          <p className="text-[15px] font-bold tracking-[-0.04em] text-ink">Vynq<span className="text-brand">.</span></p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.19em] text-ink-faint">private by design</p>
        </div>
      ) : null}
    </div>
  );
}

function DesktopRail({ active, onNavigate }: { active: NavKey; onNavigate: (key: NavKey) => void }) {
  return (
    <aside className="hidden w-[82px] shrink-0 flex-col items-center border-r border-line bg-white/80 py-5 xl:flex">
      <BrandMark compact />
      <div className="mt-16 flex flex-col gap-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={active === item.id ? "page" : undefined}
              title={item.label}
              onClick={() => onNavigate(item.id)}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-[17px] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${active === item.id ? "bg-brand text-white shadow-[0_10px_22px_rgba(92,141,246,0.28)]" : "text-ink-faint hover:bg-brand-pale hover:text-brand-strong"}`}
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={active === item.id ? 2.5 : 2} />
              {item.id === "home" ? <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#a8e3d1]" /> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-5">
        <IconButton label="Notifications" className="h-11 w-11 rounded-[17px]">
          <Bell className="h-[18px] w-[18px]" />
        </IconButton>
        <div className="rounded-full p-[2px] ring-1 ring-brand/20">
          <Avatar initials="AR" background="linear-gradient(135deg, #86b8fb, #6580d8)" size="sm" />
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ active, onNavigate }: { active: NavKey; onNavigate: (key: NavKey) => void }) {
  return (
    <nav className="safe-bottom flex h-[74px] shrink-0 items-start justify-around border-t border-line bg-white/95 px-3 pt-2 backdrop-blur-xl xl:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;
        return (
          <button
            type="button"
            key={item.id}
            aria-current={selected ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
            className={`flex min-w-[58px] flex-col items-center gap-1 rounded-2xl px-3 py-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${selected ? "text-brand-strong" : "text-ink-faint"}`}
          >
            <span className={`flex h-9 w-12 items-center justify-center rounded-2xl ${selected ? "bg-brand-soft" : ""}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={selected ? 2.5 : 2} />
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function ConversationList({
  activeId,
  onSelect,
  onOpenMobileChat,
  items,
  loading,
  onOpenSearch,
}: {
  activeId: string;
  onSelect: (conversation: Conversation) => void;
  onOpenMobileChat: () => void;
  items: Conversation[];
  loading: boolean;
  onOpenSearch: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => items.filter((conversation) => `${conversation.name} ${conversation.handle} ${conversation.lastMessage}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );

  return (
    <section className="flex min-h-0 w-full shrink-0 flex-col border-r border-line bg-white md:w-[350px] xl:w-[385px]">
      <header className="safe-top flex items-center justify-between px-5 pb-4 pt-6 md:px-6 md:pt-7">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Your space</p>
          <h1 className="text-[25px] font-bold tracking-[-0.055em] text-ink">Home</h1>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="New conversation">
            <Plus className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="More options">
            <MoreHorizontal className="h-[19px] w-[19px]" />
          </IconButton>
        </div>
      </header>

      <div className="px-5 md:px-6">
        <label className="group flex h-11 items-center gap-3 rounded-2xl bg-surface-soft px-3.5 text-ink-soft ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-brand/20">
          <Search className="h-[17px] w-[17px] shrink-0 text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          />
          <kbd className="hidden rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint shadow-sm sm:inline-block">⌘ K</kbd>
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between px-5 md:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">Friends</p>
        <span className="rounded-full bg-brand-pale px-2 py-1 text-[10px] font-bold text-brand-strong">{items.length} connected</span>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3 md:px-4">
        {loading ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-brand" />
            <p className="mt-3 text-sm font-semibold text-ink">Loading your people</p>
            <p className="mt-1 text-xs text-ink-soft">Your accepted friends will appear here.</p>
          </div>
        ) : filtered.length ? filtered.map((conversation, index) => (
          <button
            type="button"
            key={conversation.id}
            onClick={() => {
              onSelect(conversation);
              onOpenMobileChat();
            }}
            className={`enter-up group flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition hover:bg-brand-pale focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 ${activeId === conversation.id ? "bg-brand-pale" : ""}`}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <Avatar initials={conversation.initials} background={conversation.avatar} online={conversation.online} size="md" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-bold tracking-[-0.02em] text-ink">{conversation.name}</span>
                <span className={`shrink-0 text-[10px] font-medium ${conversation.unread ? "text-brand-strong" : "text-ink-faint"}`}>{conversation.lastTime}</span>
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[12px] text-ink-soft">{conversation.lastMessage}</span>
                {conversation.unread ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{conversation.unread}</span> : null}
              </span>
            </span>
          </button>
        )) : items.length ? (
          <div className="px-4 py-10 text-center">
            <Search className="mx-auto h-6 w-6 text-ink-faint" />
            <p className="mt-3 text-sm font-semibold text-ink">No friends match</p>
            <p className="mt-1 text-xs text-ink-soft">Try another name or handle.</p>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <Users className="mx-auto h-6 w-6 text-ink-faint" />
            <p className="mt-3 text-sm font-semibold text-ink">No friends yet</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">Find someone by username and send a private follow request.</p>
            <button type="button" onClick={onOpenSearch} className="mt-4 rounded-xl bg-brand-pale px-3 py-2 text-[11px] font-bold text-brand-strong hover:bg-brand-soft">Find people</button>
          </div>
        )}
      </div>

      <div className="mx-5 mb-5 flex items-center gap-2 rounded-2xl bg-brand-pale px-3.5 py-3 md:mx-6">
        <LockKeyhole className="h-4 w-4 shrink-0 text-brand" />
        <p className="text-[11px] leading-4 text-ink-soft">Messages disappear automatically after 24 hours.</p>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const mine = message.sender === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] sm:max-w-[66%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        {message.type === "text" ? (
          <div className={`rounded-[19px] px-4 py-3 text-[13px] leading-5 shadow-[0_3px_12px_rgba(57,85,120,0.04)] ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-line bg-white text-ink"}`}>
            {message.text}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-[19px] border ${mine ? "rounded-br-md border-brand/30" : "rounded-bl-md border-line"} bg-white p-1.5 shadow-[0_3px_12px_rgba(57,85,120,0.04)]`}>
            <div className="relative h-[172px] w-[218px] overflow-hidden rounded-[14px]" style={{ background: message.accent }}>
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(130deg,transparent_20%,rgba(255,255,255,0.6)_20%,transparent_48%),linear-gradient(35deg,rgba(255,255,255,0.25),transparent_34%)]" />
              {message.type === "video" ? (
                <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand shadow-float">
                  <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-brand" />
                </span>
              ) : null}
              <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/20 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur-sm">{message.type === "video" ? "0:18" : "preview"}</span>
            </div>
          </div>
        )}
        <span className={`mt-1.5 flex items-center gap-1 text-[10px] font-medium text-ink-faint ${mine ? "mr-1" : "ml-1"}`}>
          {message.time}
          {mine ? <CheckCheck className="h-3.5 w-3.5 text-brand" /> : null}
        </span>
      </div>
    </div>
  );
}

export function ChatPanel({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const [message, setMessage] = useState("");
  const [sentMessages, setSentMessages] = useState<Message[]>([]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setSentMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        sender: "me",
        type: "text",
        text: trimmed,
        time: "Now",
        read: false,
      },
    ]);
    setMessage("");
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-soft">
      <header className="safe-top flex h-[76px] shrink-0 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-lg sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to conversations" className="mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-pale hover:text-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 md:hidden">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <Avatar initials={conversation.initials} background={conversation.avatar} online={conversation.online} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[14px] font-bold tracking-[-0.025em] text-ink">{conversation.name}</h2>
              <span className="hidden rounded-full bg-brand-pale px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-brand-strong sm:inline-flex">Friend</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-ink-soft">{conversation.online ? "Active now" : "Last seen recently"} <span className="px-1 text-ink-faint">·</span> expires in {conversation.expiry}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <IconButton label="Start voice call" className="hidden sm:inline-flex"><Phone className="h-[17px] w-[17px]" /></IconButton>
          <IconButton label="Start video call" className="hidden sm:inline-flex"><Video className="h-[18px] w-[18px]" /></IconButton>
          <IconButton label="Conversation info"><Info className="h-[18px] w-[18px]" /></IconButton>
          <IconButton label="More options"><Ellipsis className="h-[19px] w-[19px]" /></IconButton>
        </div>
      </header>

      <div className="chat-paper no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="mx-auto flex items-center gap-2 rounded-full border border-brand/10 bg-white/80 px-3.5 py-2 text-[10px] font-semibold text-ink-soft shadow-[0_3px_10px_rgba(50,86,135,0.04)] backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            Messages disappear after 24 hours
          </div>
          <div className="my-1 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            Today
            <span className="h-px flex-1 bg-line" />
          </div>
          {[...conversation.messages, ...sentMessages].map((item) => <MessageBubble key={item.id} message={item} />)}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-white/95 px-3 pb-3 pt-3 backdrop-blur-xl sm:px-6 sm:pb-5">
        <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-[20px] border border-line bg-surface-soft p-1.5 pl-2 shadow-[0_8px_24px_rgba(75,112,159,0.06)] transition focus-within:border-brand/30 focus-within:bg-white focus-within:shadow-[0_8px_30px_rgba(92,141,246,0.1)]">
          <IconButton label="Attach a file" className="h-9 w-9 shrink-0 rounded-[14px]"><Paperclip className="h-[17px] w-[17px]" /></IconButton>
          <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" className="min-h-9 min-w-0 flex-1 bg-transparent px-1 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint" />
          <IconButton label="Add emoji" className="hidden h-9 w-9 shrink-0 rounded-[14px] sm:inline-flex"><Smile className="h-[17px] w-[17px]" /></IconButton>
          {message.trim() ? (
            <button type="submit" aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-brand text-white shadow-[0_8px_16px_rgba(92,141,246,0.25)] transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"><Send className="h-[16px] w-[16px]" /></button>
          ) : (
            <IconButton label="Record voice message" className="h-9 w-9 shrink-0 rounded-[14px] bg-brand text-white hover:bg-brand-strong hover:text-white"><Mic className="h-[16px] w-[16px]" /></IconButton>
          )}
        </form>
        <p className="mx-auto mt-2 hidden max-w-3xl items-center justify-center gap-1 text-center text-[10px] text-ink-faint sm:flex"><LockKeyhole className="h-3 w-3" /> Private space · expires automatically</p>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: LucideIcon }) {
  return (
    <header className="safe-top border-b border-line bg-white px-5 pb-6 pt-7 md:px-10 md:pb-8 md:pt-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand"><Icon className="h-3.5 w-3.5" /> {eyebrow}</div>
            <h1 className="text-[29px] font-bold tracking-[-0.06em] text-ink md:text-[38px]">{title}</h1>
            <p className="mt-2 max-w-lg text-[13px] leading-5 text-ink-soft">{description}</p>
          </div>
          <IconButton label="More options" className="shrink-0"><MoreHorizontal className="h-[19px] w-[19px]" /></IconButton>
        </div>
      </div>
    </header>
  );
}

function SearchPanel({ currentUid, onRefresh, onOpenProfile }: { currentUid: string; onRefresh: () => Promise<void>; onOpenProfile: () => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SocialProfile | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus>("none");
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const normalizedQuery = normalizeUsername(query);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (normalizedQuery.length < 3) {
        setResult(null);
        setRelationship("none");
        setSearching(false);
        setError("");
        return;
      }

      setSearching(true);
      setError("");
      try {
        const profile = await fetchProfileByUsername(normalizedQuery);
        if (cancelled) return;
        setResult(profile);
        setRelationship(profile ? await fetchRelationship(currentUid, profile.uid) : "none");
      } catch (searchError) {
        if (!cancelled) setError(getSocialErrorMessage(searchError));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentUid, normalizedQuery]);

  const requestFollow = async () => {
    if (!result || relationship !== "none") return;
    setActionLoading(true);
    setError("");
    try {
      await sendFollowRequest(result.uid);
      setRelationship("requested");
      await onRefresh();
    } catch (requestError) {
      setError(getSocialErrorMessage(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const action = relationship === "friends"
    ? <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Friends</span>
    : relationship === "requested"
      ? <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Requested</span>
      : relationship === "incoming"
        ? <span className="flex items-center gap-1.5"><UserRoundCheck className="h-3.5 w-3.5" /> Respond</span>
        : <span className="flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Follow</span>;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface-soft">
      <SectionHeader eyebrow="Find your people" title="Search" description="Find someone by their username, send a request, and start a private space when they accept." icon={Search} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-4xl">
          <label className="flex h-14 items-center gap-3 rounded-[18px] border border-line bg-white px-4 shadow-[0_7px_20px_rgba(75,112,159,0.06)] ring-1 ring-transparent transition focus-within:border-brand/30 focus-within:ring-brand/10">
            <Search className="h-[19px] w-[19px] text-brand" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by username" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-faint" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-ink-faint hover:text-ink"><X className="h-4 w-4" /></button> : null}
          </label>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-ink-faint">{normalizedQuery.length >= 3 ? "People" : "Exact username search"}</p>
              {searching ? <LoaderCircle className="h-4 w-4 animate-spin text-brand" /> : null}
            </div>

            {error ? <p role="alert" className="mb-3 rounded-2xl border border-[#f3c7c7] bg-[#fff5f5] px-4 py-3 text-[11px] font-semibold leading-4 text-[#b74d56]">{error}</p> : null}

            {normalizedQuery.length < 3 ? (
              <div className="rounded-[22px] border border-dashed border-brand/20 bg-brand-pale p-6 text-center">
                <Search className="mx-auto h-6 w-6 text-brand" />
                <p className="mt-3 text-sm font-bold text-ink">Search by username</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-soft">Type at least three characters. Vynq does not expose a public people directory.</p>
              </div>
            ) : result ? (
              <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-white p-4 shadow-[0_7px_20px_rgba(75,112,159,0.05)] sm:flex-row sm:items-center">
                <Avatar initials={profileInitials(result)} background={profileAvatar(result)} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink">{result.displayName}</p>
                  <p className="mt-1 truncate text-[12px] text-brand-strong">@{result.username}</p>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-ink-soft">{result.bio || "Keeping conversations close and short-lived."}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-ink-faint"><LockKeyhole className="h-3 w-3" /> Chat unlocks after acceptance</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/profile/${result.username}`} className="rounded-2xl border border-line px-3.5 py-2.5 text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong">View profile</Link>
                  {relationship === "incoming" ? (
                    <button type="button" onClick={onOpenProfile} className="rounded-2xl bg-brand px-3.5 py-2.5 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(92,141,246,0.22)] hover:bg-brand-strong">{action}</button>
                  ) : (
                    <button type="button" disabled={actionLoading || relationship === "friends" || relationship === "requested"} onClick={requestFollow} className={`rounded-2xl px-3.5 py-2.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${relationship === "friends" || relationship === "requested" ? "bg-success/10 text-success" : "bg-brand text-white shadow-[0_8px_16px_rgba(92,141,246,0.22)] hover:bg-brand-strong disabled:opacity-60"}`}>
                      {actionLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : action}
                    </button>
                  )}
                </div>
              </div>
            ) : searching ? (
              <div className="rounded-[22px] border border-line bg-white p-6 text-center text-xs text-ink-soft">Looking for that username…</div>
            ) : (
              <div className="rounded-[22px] border border-line bg-white p-6 text-center">
                <UserRoundX className="mx-auto h-6 w-6 text-ink-faint" />
                <p className="mt-3 text-sm font-bold text-ink">No verified profile found</p>
                <p className="mt-1 text-xs text-ink-soft">Check the spelling and try again.</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-[20px] border border-brand/10 bg-brand-pale p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-sm"><ShieldCheck className="h-[19px] w-[19px]" /></div>
            <div><p className="text-[12px] font-bold text-ink">Your search stays private</p><p className="mt-1 text-[11px] leading-4 text-ink-soft">Only verified members can find people or send requests.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StatusPanel() {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface-soft">
      <SectionHeader eyebrow="Share a moment" title="Status" description="Share an image or a short video with accepted friends. Every status disappears after 24 hours." icon={CircleDashed} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-end gap-5">
            <button type="button" onClick={() => setComposerOpen(true)} className="group flex w-[92px] flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15">
              <span className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full border-2 border-dashed border-brand/50 bg-white transition group-hover:border-brand group-hover:bg-brand-pale">
                <Plus className="h-6 w-6 text-brand" />
                <span className="absolute -bottom-1 rounded-full bg-brand px-2 py-1 text-[9px] font-bold text-white">Add</span>
              </span>
              <span className="text-[11px] font-bold text-ink">Your status</span>
            </button>
            {statuses.map((status) => (
              <button key={status.id} type="button" className="group flex w-[92px] flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15">
                <span className="rounded-full p-[3px] ring-gradient transition group-hover:scale-105"><Avatar initials={status.initials} background={status.avatar} size="xl" /></span>
                <span className="text-[11px] font-bold text-ink">{status.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-ink-faint">Recent updates</p><span className="flex items-center gap-1 text-[10px] font-semibold text-ink-faint"><Clock3 className="h-3 w-3" /> 24h lifetime</span></div>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {statuses.map((status) => (
              <button key={status.id} type="button" className="group relative h-48 overflow-hidden rounded-[22px] text-left shadow-[0_8px_24px_rgba(75,112,159,0.1)] transition hover:-translate-y-1 hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15" style={{ background: status.accent }}>
                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,transparent_15%,rgba(255,255,255,0.55)_15%,transparent_42%),linear-gradient(20deg,rgba(20,49,90,0.12),transparent_58%)]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1e3458]/55 to-transparent p-4 pt-12 text-white"><p className="text-[12px] font-bold">{status.name}</p><p className="mt-1 text-[10px] text-white/80">{status.time}</p></div>
                <span className="absolute right-3 top-3 rounded-full bg-white/75 px-2 py-1 text-[9px] font-bold text-ink backdrop-blur-sm">View</span>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-[22px] border border-line bg-white p-4 sm:flex sm:items-center sm:gap-4 sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-pale text-brand"><LockKeyhole className="h-[19px] w-[19px]" /></div>
            <div className="mt-3 sm:mt-0"><p className="text-[12px] font-bold text-ink">Friends only, by default</p><p className="mt-1 text-[11px] leading-4 text-ink-soft">Only accepted friends can view your status updates. No public discovery.</p></div>
            <button type="button" onClick={() => setComposerOpen(true)} className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-pale px-3 py-2 text-[11px] font-bold text-brand-strong hover:bg-brand-soft sm:ml-auto sm:mt-0"><ImageIcon className="h-3.5 w-3.5" /> Create status</button>
          </div>
        </div>
      </div>
      {composerOpen ? <div className="absolute inset-0 z-30 flex items-end justify-center bg-ink/15 p-4 backdrop-blur-sm sm:items-center"><div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_24px_80px_rgba(33,62,104,0.2)]"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">New status</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.05em] text-ink">Share a moment</h2></div><IconButton label="Close" onClick={() => setComposerOpen(false)}><X className="h-[18px] w-[18px]" /></IconButton></div><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" className="flex h-28 flex-col items-center justify-center gap-2 rounded-[20px] border border-line bg-surface-soft text-ink-soft hover:border-brand/30 hover:bg-brand-pale"><ImageIcon className="h-6 w-6 text-brand" /><span className="text-[11px] font-bold">Image</span></button><button type="button" className="flex h-28 flex-col items-center justify-center gap-2 rounded-[20px] border border-line bg-surface-soft text-ink-soft hover:border-brand/30 hover:bg-brand-pale"><Video className="h-6 w-6 text-brand" /><span className="text-[11px] font-bold">Video · max 30s</span></button></div><p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-ink-faint"><Clock3 className="h-3 w-3" /> Automatically deleted after 24 hours</p></div></div> : null}
    </section>
  );
}

function ProfilePanel({
  onSignOut,
  snapshot,
  loading,
  onRefresh,
}: {
  onSignOut: () => void;
  snapshot: SocialSnapshot | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [requestActionId, setRequestActionId] = useState("");
  const [actionError, setActionError] = useState("");
  const profile = snapshot?.profile;

  const respond = async (requestId: string, decision: "accepted" | "rejected") => {
    setRequestActionId(requestId);
    setActionError("");
    try {
      await respondToFollowRequest(requestId, decision);
      await onRefresh();
    } catch (responseError) {
      setActionError(getSocialErrorMessage(responseError));
    } finally {
      setRequestActionId("");
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface-soft">
      <SectionHeader eyebrow="Your account" title="Profile" description="See who is connected, handle requests, and keep your identity simple." icon={UserRound} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center rounded-[26px] border border-line bg-white px-5 py-8 text-center shadow-[0_8px_24px_rgba(75,112,159,0.06)] sm:flex-row sm:items-center sm:gap-5 sm:px-7 sm:text-left">
            {profile ? <Avatar initials={profileInitials(profile)} background={profileAvatar(profile)} size="xl" online /> : <div className="h-20 w-20 animate-pulse rounded-full bg-brand-pale" />}
            <div className="mt-4 min-w-0 sm:mt-0">
              <p className="text-xl font-bold tracking-[-0.05em] text-ink">{profile?.displayName || "Your Vynq profile"}</p>
              <p className="mt-1 text-[13px] text-brand-strong">{profile ? `@${profile.username}` : "Loading username…"}</p>
              <p className="mt-2 text-[11px] text-ink-soft">{profile?.bio || "Add a little context for the people you let in."}</p>
            </div>
            {profile ? <Link href={`/profile/${profile.username}`} className="mt-5 rounded-2xl border border-line px-4 py-2.5 text-[11px] font-bold text-ink-soft hover:border-brand/25 hover:bg-brand-pale hover:text-brand-strong sm:ml-auto sm:mt-0">View profile</Link> : null}
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-[22px] border border-line bg-white py-4">
            {[
              [snapshot?.friends.length ?? 0, "Friends"],
              [snapshot?.followers.length ?? 0, "Followers"],
              [snapshot?.following.length ?? 0, "Following"],
            ].map(([value, label]) => <div key={label as string} className="text-center"><p className="text-lg font-bold tracking-[-0.04em] text-ink">{value as number}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label as string}</p></div>)}
          </div>

          {actionError ? <p role="alert" className="mt-5 rounded-2xl border border-[#f3c7c7] bg-[#fff5f5] px-4 py-3 text-[11px] font-semibold leading-4 text-[#b74d56]">{actionError}</p> : null}

          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-ink-faint">Follow requests</p><span className="rounded-full bg-brand-pale px-2 py-1 text-[10px] font-bold text-brand-strong">{snapshot?.incomingRequests.length ?? 0} waiting</span></div>
            <div className="overflow-hidden rounded-[22px] border border-line bg-white">
              {loading ? <div className="flex items-center gap-2 px-4 py-5 text-[11px] text-ink-soft"><LoaderCircle className="h-4 w-4 animate-spin text-brand" /> Loading requests…</div> : snapshot?.incomingRequests.length ? snapshot.incomingRequests.map((request) => request.profile ? (
                <div key={request.id} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0">
                  <Avatar initials={profileInitials(request.profile)} background={profileAvatar(request.profile)} size="sm" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-ink">{request.profile.displayName}</p><p className="mt-0.5 truncate text-[11px] text-brand-strong">@{request.profile.username}</p></div>
                  <div className="flex items-center gap-1.5"><button type="button" disabled={requestActionId === request.id} onClick={() => void respond(request.id, "accepted")} className="inline-flex h-8 items-center gap-1 rounded-xl bg-brand px-2.5 text-[10px] font-bold text-white hover:bg-brand-strong disabled:opacity-60"><UserCheck className="h-3.5 w-3.5" /> Accept</button><button type="button" disabled={requestActionId === request.id} onClick={() => void respond(request.id, "rejected")} aria-label={`Reject ${request.profile.username}`} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-line text-ink-faint hover:border-[#f3c7c7] hover:bg-[#fff5f5] hover:text-[#b74d56] disabled:opacity-60"><UserRoundX className="h-3.5 w-3.5" /></button></div>
                </div>
              ) : null) : <div className="px-4 py-5 text-[11px] leading-5 text-ink-soft">No new requests. When someone finds you, their request will appear here.</div>}
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-ink-faint">Friends list</p><span className="flex items-center gap-1 text-[10px] font-semibold text-ink-faint"><Users className="h-3 w-3" /> Private connections</span></div>
            <div className="overflow-hidden rounded-[22px] border border-line bg-white">
              {loading ? <div className="flex items-center gap-2 px-4 py-5 text-[11px] text-ink-soft"><LoaderCircle className="h-4 w-4 animate-spin text-brand" /> Loading friends…</div> : snapshot?.friends.length ? snapshot.friends.map((friend) => (
                <Link key={friend.uid} href={`/profile/${friend.username}`} className="flex items-center gap-3 border-b border-line px-4 py-4 transition last:border-b-0 hover:bg-surface-soft">
                  <Avatar initials={profileInitials(friend)} background={profileAvatar(friend)} size="sm" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-ink">{friend.displayName}</span><span className="mt-0.5 block truncate text-[11px] text-brand-strong">@{friend.username}</span></span>
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">Friend</span>
                </Link>
              )) : <div className="px-4 py-5 text-[11px] leading-5 text-ink-soft">Accepted friends will appear here and unlock a private chat entry on Home.</div>}
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {[
              ["Followers", snapshot?.followers ?? []],
              ["Following", snapshot?.following ?? []],
            ].map(([label, people]) => {
              const profiles = people as SocialProfile[];
              return <div key={label as string} className="rounded-[22px] border border-line bg-white p-4"><div className="flex items-center justify-between"><p className="text-[12px] font-bold text-ink">{label as string}</p><span className="text-[10px] font-semibold text-ink-faint">{profiles.length}</span></div><div className="mt-4 space-y-3">{profiles.length ? profiles.slice(0, 3).map((person) => <Link key={person.uid} href={`/profile/${person.username}`} className="flex items-center gap-2.5"><Avatar initials={profileInitials(person)} background={profileAvatar(person)} size="xs" /><span className="min-w-0 truncate text-[11px] font-semibold text-ink-soft">@{person.username}</span></Link>) : <p className="text-[11px] leading-5 text-ink-soft">No accepted {String(label).toLowerCase()} yet.</p>}</div></div>;
            })}
          </div>

          <div className="mt-7"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.17em] text-ink-faint">Privacy controls</p><div className="overflow-hidden rounded-[22px] border border-line bg-white">
            {[
              [ShieldCheck, "Privacy by default", "Only accepted friends can reach you"],
              [Clock3, "Ephemeral messages", "Messages and media expire after 24 hours"],
            ].map(([Icon, title, detail]) => { const RowIcon = Icon as LucideIcon; return <button type="button" key={title as string} className="flex w-full items-center gap-3 border-b border-line px-4 py-4 text-left last:border-b-0 hover:bg-surface-soft"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand"><RowIcon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-ink">{title as string}</span><span className="mt-1 block truncate text-[11px] text-ink-soft">{detail as string}</span></span><ChevronRight className="h-4 w-4 text-ink-faint" /></button>; })}
            <NotificationPermission />
          </div></div>

          <PwaInstallCard />
          <button type="button" onClick={onSignOut} className="mt-6 flex items-center gap-2 px-1 text-[11px] font-bold text-ink-faint hover:text-ink"><LogOut className="h-4 w-4" /> Sign out</button>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[10px] text-ink-faint"><LockKeyhole className="h-3 w-3" /> Profiles stay private until you connect.</p>
        </div>
      </div>
    </section>
  );
}

function EmptyChatPanel({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-surface-soft px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-pale text-brand"><Users className="h-7 w-7" /></div>
        <p className="mt-5 text-lg font-bold tracking-[-0.04em] text-ink">Your private space starts with a friend.</p>
        <p className="mt-2 text-[12px] leading-5 text-ink-soft">Search for a username, send a request, and the chat entry will appear here after they accept.</p>
        <button type="button" onClick={onOpenSearch} className="mt-5 rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(92,141,246,0.22)] hover:bg-brand-strong">Find people</button>
      </div>
    </section>
  );
}

export default function VynqShell() {
  const { signOutUser, user } = useAuth();
  const [activeNav, setActiveNav] = useState<NavKey>("home");
  const [socialSnapshot, setSocialSnapshot] = useState<SocialSnapshot | null>(null);
  const [socialLoading, setSocialLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [conversationMeta, setConversationMeta] = useState<Record<string, ConversationMeta>>({});

  const refreshSocial = async () => {
    if (!user?.uid) {
      setSocialSnapshot(null);
      setSocialLoading(false);
      return;
    }

    setSocialLoading(true);
    try {
      setSocialSnapshot(await fetchSocialSnapshot(user.uid));
    } catch {
      setSocialSnapshot(null);
    } finally {
      setSocialLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) {
        if (!cancelled) {
          setSocialSnapshot(null);
          setSocialLoading(false);
        }
        return;
      }

      setSocialLoading(true);
      try {
        const nextSnapshot = await fetchSocialSnapshot(user.uid);
        if (!cancelled) setSocialSnapshot(nextSnapshot);
      } catch {
        if (!cancelled) setSocialSnapshot(null);
      } finally {
        if (!cancelled) setSocialLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return startPresence(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    const friends = socialSnapshot?.friends ?? [];
    if (!friends.length) return undefined;
    const unsubscribers = friends.map((friend) => listenToConversationMeta(
      friend.friendshipId,
      (meta) => {
        if (!meta) return;
        setConversationMeta((current) => ({ ...current, [meta.id]: meta }));
      },
      () => undefined,
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [socialSnapshot?.friends]);

  const friendConversations = useMemo(
    () => socialSnapshot?.friends.map((friend) => conversationForFriend(friend, conversationMeta[friend.friendshipId])) ?? [],
    [conversationMeta, socialSnapshot?.friends],
  );
  const resolvedConversationId = activeConversationId && friendConversations.some((conversation) => conversation.id === activeConversationId)
    ? activeConversationId
    : friendConversations[0]?.id ?? null;
  const activeConversation = friendConversations.find((conversation) => conversation.id === resolvedConversationId) ?? null;

  const navigate = (key: NavKey) => {
    setActiveNav(key);
    if (key === "home") setMobileChatOpen(Boolean(resolvedConversationId));
    else setMobileChatOpen(false);
  };

  const openSearch = () => navigate("search");
  const openProfile = () => navigate("profile");

  return (
    <main className="min-h-[100svh] p-0 text-ink md:p-4 lg:p-7">
      <div className="mx-auto flex h-[100svh] max-w-[1600px] flex-col overflow-hidden border-line bg-surface shadow-soft md:h-[calc(100svh-2rem)] md:rounded-[28px] md:border lg:h-[calc(100svh-3.5rem)] lg:rounded-[32px]">
        <div className="flex min-h-0 flex-1">
          <DesktopRail active={activeNav} onNavigate={navigate} />
          {activeNav === "home" ? (
            <>
              <div className={`${mobileChatOpen ? "hidden" : "flex"} min-h-0 w-full shrink-0 md:flex md:w-auto`}>
                <ConversationList activeId={activeConversation?.id ?? ""} onSelect={(conversation) => { setActiveConversationId(conversation.id); setMobileChatOpen(true); }} onOpenMobileChat={() => setMobileChatOpen(true)} items={friendConversations} loading={socialLoading} onOpenSearch={openSearch} />
              </div>
              <div className={`${mobileChatOpen ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 md:flex`}>
                {activeConversation ? <RealtimeChatPanel key={activeConversation.id} conversation={activeConversation} currentUid={user?.uid ?? ""} onBack={() => setMobileChatOpen(false)} /> : <EmptyChatPanel onOpenSearch={openSearch} />}
              </div>
            </>
          ) : (
            <div className="relative flex min-h-0 min-w-0 flex-1">
              {activeNav === "search" ? <SearchPanel currentUid={user?.uid ?? ""} onRefresh={refreshSocial} onOpenProfile={openProfile} /> : null}
              {activeNav === "status" ? <LiveStatusPanel /> : null}
              {activeNav === "profile" ? <ProfilePanel snapshot={socialSnapshot} loading={socialLoading} onRefresh={refreshSocial} onSignOut={() => void signOutUser()} /> : null}
            </div>
          )}
        </div>
        <MobileNav active={activeNav} onNavigate={navigate} />
      </div>
    </main>
  );
}
