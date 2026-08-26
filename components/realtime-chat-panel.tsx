"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  Ellipsis,
  Info,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Mic,
  Phone,
  Send,
  ShieldCheck,
  Smile,
  Video,
} from "lucide-react";
import type { Conversation } from "@/lib/mock-data";
import ChatMediaComposer from "@/components/chat-media-composer";
import SecureChatMedia from "@/components/secure-chat-media";
import {
  formatChatTime,
  formatLastSeen,
  listenToMessages,
  listenToPresence,
  listenToTyping,
  markMessageRead,
  sendTextMessage,
  setTyping,
} from "@/lib/chat/chat-actions";
import type { ChatMessage, PresenceState } from "@/lib/chat/types";

type AvatarProps = {
  initials: string;
  background: string;
  online?: boolean;
};

function Avatar({ initials, background, online }: AvatarProps) {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-[-0.04em] text-white" style={{ background }}>
      {initials}
      {online ? <span className="presence-pulse absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success" /> : null}
    </div>
  );
}

function IconButton({ label, children, disabled = false }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-ink-soft transition hover:-translate-y-0.5 hover:bg-brand-pale hover:text-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MessageBubble({ message, currentUid }: { message: ChatMessage; currentUid: string }) {
  const mine = message.senderUid === currentUid;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[78%] flex-col sm:max-w-[66%] ${mine ? "items-end" : "items-start"}`}>
        {message.type === "text" ? <div className={`rounded-[19px] px-4 py-3 text-[13px] leading-5 shadow-[0_3px_12px_rgba(57,85,120,0.04)] ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-line bg-white text-ink"}`}>
          {message.text}
        </div> : <div className={`w-[min(270px,100%)] overflow-hidden rounded-[19px] border p-1.5 shadow-[0_3px_12px_rgba(57,85,120,0.06)] ${mine ? "rounded-br-md border-brand/25 bg-brand-pale" : "rounded-bl-md border-line bg-white"}`}><SecureChatMedia message={message} /></div>}
        <span className={`mt-1.5 flex items-center gap-1 text-[10px] font-medium text-ink-faint ${mine ? "mr-1" : "ml-1"}`}>
          {formatChatTime(message.createdAt)}
          {mine ? <CheckCheck className={`h-3.5 w-3.5 ${message.readAt ? "text-brand" : "text-ink-faint"}`} /> : null}
        </span>
      </div>
    </div>
  );
}

export default function RealtimeChatPanel({ conversation, currentUid, onBack }: { conversation: Conversation; currentUid: string; onBack: () => void }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PresenceState | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const markedRead = useRef(new Set<string>());
  const seenMessageIds = useRef(new Set<string>());
  const peerUid = conversation.peerUid ?? "";

  useEffect(() => {
    return listenToMessages(conversation.id, setMessages, () => setChatError("Messages could not be loaded. Check your connection."));
  }, [conversation.id]);

  useEffect(() => {
    const nextExpiry = messages.reduce<number | null>((soonest, item) => {
      const expiry = item.expiresAt?.toMillis() ?? null;
      if (!expiry || expiry <= Date.now()) return soonest;
      return soonest === null || expiry < soonest ? expiry : soonest;
    }, null);
    if (!nextExpiry) return undefined;
    const timeout = window.setTimeout(() => setClock(Date.now()), Math.max(0, nextExpiry - Date.now()) + 120);
    return () => window.clearTimeout(timeout);
  }, [clock, messages]);

  const visibleMessages = useMemo(
    () => messages.filter((item) => (item.expiresAt?.toMillis() ?? 0) > clock),
    [clock, messages],
  );

  useEffect(() => {
    if (!peerUid) return undefined;
    return listenToPresence(peerUid, setPresence, () => undefined);
  }, [peerUid]);

  useEffect(() => {
    if (!peerUid) return undefined;
    return listenToTyping(conversation.id, peerUid, setPeerTyping, () => undefined);
  }, [conversation.id, peerUid]);

  useEffect(() => {
    visibleMessages.forEach((item) => {
      if (item.senderUid === currentUid || item.readAt || markedRead.current.has(item.id)) return;
      markedRead.current.add(item.id);
      void markMessageRead(conversation.id, item.id).catch(() => markedRead.current.delete(item.id));
    });
  }, [conversation.id, currentUid, visibleMessages]);

  useEffect(() => {
    const newIncoming = visibleMessages.filter((item) => item.senderUid !== currentUid && !seenMessageIds.current.has(item.id));
    if (seenMessageIds.current.size > 0 && document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      const latest = newIncoming[newIncoming.length - 1];
      if (latest) {
        new Notification("Vynq", {
          body: "New private message",
          icon: "/icons/vynq-192.png",
          tag: conversation.id,
        });
      }
    }
    visibleMessages.forEach((item) => seenMessageIds.current.add(item.id));
  }, [conversation.id, conversation.name, currentUid, visibleMessages]);

  useEffect(() => {
    if (!currentUid) return undefined;
    if (!message.trim()) {
      void setTyping(conversation.id, currentUid, false);
      return undefined;
    }
    void setTyping(conversation.id, currentUid, true);
    const timeout = window.setTimeout(() => void setTyping(conversation.id, currentUid, false), 1400);
    return () => {
      window.clearTimeout(timeout);
      void setTyping(conversation.id, currentUid, false);
    };
  }, [conversation.id, currentUid, message]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setChatError("");
    try {
      await sendTextMessage(conversation.id, trimmed);
      setMessage("");
      void setTyping(conversation.id, currentUid, false);
    } catch {
      setChatError("Message could not be sent. Check your Supabase connection and policies.");
    } finally {
      setSending(false);
    }
  };

  const isOnline = presence?.state === "online";
  const presenceLabel = peerTyping
    ? `${conversation.name} is typing...`
    : isOnline
      ? "Active now"
      : formatLastSeen(presence?.lastChanged);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-soft">
      <header className="safe-top flex h-[76px] shrink-0 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-lg sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to conversations" className="mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-pale hover:text-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 md:hidden">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <Avatar initials={conversation.initials} background={conversation.avatar} online={isOnline} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[14px] font-bold tracking-[-0.025em] text-ink">{conversation.name}</h2>
              <span className="hidden rounded-full bg-brand-pale px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-brand-strong sm:inline-flex">Friend</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-ink-soft">{presenceLabel} <span className="px-1 text-ink-faint">·</span> messages expire in 24h</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <IconButton label="Start voice call" disabled><Phone className="h-[17px] w-[17px]" /></IconButton>
          <IconButton label="Start video call" disabled><Video className="h-[18px] w-[18px]" /></IconButton>
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
          {visibleMessages.length ? <div className="my-1 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint"><span className="h-px flex-1 bg-line" />Recent<span className="h-px flex-1 bg-line" /></div> : null}
          {visibleMessages.length ? visibleMessages.map((item) => <MessageBubble key={item.id} message={item} currentUid={currentUid} />) : (
            <div className="mx-auto max-w-xs py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-pale text-brand"><MessageCircle className="h-5 w-5" /></div>
              <p className="mt-4 text-sm font-bold text-ink">Start the conversation</p>
              <p className="mt-1 text-[11px] leading-5 text-ink-soft">Send a private message to {conversation.name}. It will disappear automatically after 24 hours.</p>
            </div>
          )}
          {peerTyping ? <div className="flex items-center gap-2 text-[10px] font-semibold text-ink-faint"><span className="flex items-center gap-1 rounded-full bg-white px-3 py-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:300ms]" /></span>{conversation.name} is typing...</div> : null}
          {chatError ? <p role="alert" className="rounded-2xl border border-[#f3c7c7] bg-[#fff5f5] px-4 py-3 text-[11px] font-semibold leading-4 text-[#b74d56]">{chatError}</p> : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-white/95 px-3 pb-3 pt-3 backdrop-blur-xl sm:px-6 sm:pb-5">
        <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-[20px] border border-line bg-surface-soft p-1.5 pl-2 shadow-[0_8px_24px_rgba(75,112,159,0.06)] transition focus-within:border-brand/30 focus-within:bg-white focus-within:shadow-[0_8px_30px_rgba(92,141,246,0.1)]">
          <ChatMediaComposer conversationId={conversation.id} disabled={sending} onError={setChatError} />
          <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} placeholder="Write a message..." className="min-h-9 min-w-0 flex-1 bg-transparent px-1 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint" />
          <IconButton label="Add emoji (available in a future phase)" disabled><Smile className="h-[17px] w-[17px]" /></IconButton>
          {message.trim() ? (
            <button type="submit" disabled={sending} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-brand text-white shadow-[0_8px_16px_rgba(92,141,246,0.25)] transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60">{sending ? <LoaderCircle className="h-[16px] w-[16px] animate-spin" /> : <Send className="h-[16px] w-[16px]" />}</button>
          ) : (
            <IconButton label="Voice messages are coming soon" disabled><Mic className="h-[16px] w-[16px]" /></IconButton>
          )}
        </form>
        <p className="mx-auto mt-2 hidden max-w-3xl items-center justify-center gap-1 text-center text-[10px] text-ink-faint sm:flex"><LockKeyhole className="h-3 w-3" /> Private space · expires automatically</p>
      </div>
    </section>
  );
}
