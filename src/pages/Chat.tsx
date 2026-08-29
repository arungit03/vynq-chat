import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/States";
import { FullScreenLoader } from "@/components/ui/Loader";
import { MessageComposer, type PendingMedia } from "@/components/MessageComposer";
import { ChatBubble } from "@/components/ChatBubble";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  getChat,
  getOrCreateChat,
  subscribeToChat,
  sendMessage,
  markChatRead,
  markMessageDelivered,
  markMessageRead,
} from "@/services/chat";
import { areFriends } from "@/services/friends";
import { getProfile } from "@/services/profile";
import { uploadChatMedia, getMediaDimensions } from "@/services/media";
import { formatLastSeen } from "@/lib/time";
import { friendlyError } from "@/lib/errorMap";
import { MESSAGE_DEFAULT_TTL_MS } from "@/lib/constants";
import type { Chat, Message, UserProfile } from "@/lib/firebase/types";

type MessageMedia = {
  url: string;
  storagePath: string;
  contentType: string;
  width?: number;
  height?: number;
  durationSec?: number;
};

function newClientMessageId() {
  return `client_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [chat, setChat] = useState<Chat | null>(null);
  const [peer, setPeer] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFriend, setNotFriend] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, setUploadProgress] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleMessages = useMemo(() => {
    const serverIds = new Set(messages.map((message) => message.id));
    return [...messages, ...localMessages.filter((message) => !serverIds.has(message.id))].sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }, [messages, localMessages]);

  // Load chat + peer
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profile || !chatId) return;
      setLoading(true);
      try {
        let c = await getChat(chatId);
        if (!c) {
          // Maybe a brand-new conversation (friend just accepted). Auto-create if friends.
          const otherId = chatId.split("_").find((id) => id !== profile.uid);
          if (otherId && (await areFriends(profile.uid, otherId))) {
            const other = await getProfile(otherId);
            if (other) c = await getOrCreateChat(profile, other);
          }
        }
        if (!c) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }
        const peerId = c.participants.find((p) => p !== profile.uid);
        const other = peerId ? await getProfile(peerId) : null;
        const friends = peerId ? await areFriends(profile.uid, peerId) : false;
        if (!cancelled) {
          setChat(c);
          setPeer(other);
          setNotFriend(!friends);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          toast(friendlyError(err), "error");
          setNotFound(true);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [chatId, profile, toast]);

  // Subscribe to messages
  useEffect(() => {
    if (!chat?.id) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToChat(chat.id, (msgs) => {
      setMessages(msgs);
      const serverIds = new Set(msgs.map((message) => message.id));
      setLocalMessages((current) => current.filter((message) => !serverIds.has(message.id)));
    }, (err) => {
      toast(friendlyError(err), "error");
    });
    return () => unsub();
  }, [chat?.id, toast]);

  // Mark chat read on open + when messages arrive
  useEffect(() => {
    if (chat && profile) markChatRead(chat, profile.uid).catch(() => {});
  }, [chat, messages, profile]);

  // Mark individual messages read
  useEffect(() => {
    if (!chat || !profile) return;
    messages.forEach((m) => {
      if (m.senderId !== profile.uid) {
        if (!m.readBy.includes(profile.uid)) {
          if (profile.privacy.readReceipts) {
            markMessageRead(m, profile.uid).catch(() => {});
          } else if (m.status === "sent") {
            markMessageDelivered(m, profile.uid).catch(() => {});
          }
        }
      }
    });
  }, [messages, chat, profile]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleMessages]);

  const submitMessage = useCallback(
    async (input: {
      id: string;
      type: "text" | "image" | "video";
      text?: string;
      media?: MessageMedia;
      replaceId?: string;
    }) => {
      if (!chat || !profile) throw new Error("Chat is still loading. Please try again.");

      const optimistic: Message = {
        id: input.id,
        chatId: chat.id,
        senderId: profile.uid,
        type: input.type,
        text: input.text ?? "",
        createdAt: Date.now(),
        expiresAt: Date.now() + MESSAGE_DEFAULT_TTL_MS,
        status: "sending",
        readBy: [],
        ...(input.media
          ? {
              mediaURL: input.media.url,
              mediaStoragePath: input.media.storagePath,
              mediaContentType: input.media.contentType,
              ...(input.media.width !== undefined ? { mediaWidth: input.media.width } : {}),
              ...(input.media.height !== undefined ? { mediaHeight: input.media.height } : {}),
              ...(input.media.durationSec !== undefined ? { mediaDurationSec: input.media.durationSec } : {}),
            }
          : {}),
      };
      setLocalMessages((current) => [
        ...current.filter((message) => message.id !== input.replaceId && message.id !== input.id),
        optimistic,
      ]);

      try {
        await sendMessage({
          chat,
          sender: profile,
          type: input.type,
          messageId: input.id,
          text: input.text,
          media: input.media,
        });
        setLocalMessages((current) =>
          current.map((message) => (message.id === input.id ? { ...message, status: "sent" } : message)),
        );
      } catch (error) {
        setLocalMessages((current) =>
          current.map((message) => (message.id === input.id ? { ...message, status: "failed" } : message)),
        );
        throw error;
      }
    },
    [chat, profile],
  );

  const sendText = useCallback(
    async (text: string) => {
      await submitMessage({ id: newClientMessageId(), type: "text", text });
    },
    [submitMessage],
  );

  const sendMedia = useCallback(
    async (media: PendingMedia) => {
      if (!chat || !profile) return;
      setUploading(true);
      setUploadProgress(0);
      try {
        const messageId = newClientMessageId();
        const dims = await getMediaDimensions(media.file);
        const { url, path, contentType } = await uploadChatMedia({
          chatId: chat.id,
          messageId,
          file: media.file,
          onProgress: (p) => setUploadProgress(p),
        });
        await submitMessage({
          id: messageId,
          type: media.kind,
          media: {
            url,
            storagePath: path,
            contentType,
            width: dims.width,
            height: dims.height,
          },
        });
      } finally {
        setUploading(false);
      }
    },
    [chat, profile, submitMessage],
  );

  const retryMessage = useCallback(
    async (message: Message) => {
      const media =
        message.mediaURL && message.mediaStoragePath && message.mediaContentType
          ? {
              url: message.mediaURL,
              storagePath: message.mediaStoragePath,
              contentType: message.mediaContentType,
              width: message.mediaWidth,
              height: message.mediaHeight,
              durationSec: message.mediaDurationSec,
            }
          : undefined;
      if (message.type !== "text" && !media) {
        toast("This attachment is no longer available. Please select it again.", "error");
        return;
      }
      try {
        await submitMessage({
          id: newClientMessageId(),
          type: message.type,
          text: message.type === "text" ? message.text : undefined,
          media,
          replaceId: message.id,
        });
      } catch (error) {
        toast(friendlyError(error), "error");
      }
    },
    [submitMessage, toast],
  );

  if (loading) return <FullScreenLoader label="Opening chat…" />;

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50 p-6">
        <EmptyState
          title="Conversation not found"
          description="This chat may have ended or the user is no longer connected with you."
          action={
            <Link to="/home" className="btn-primary">
              Back to chats
            </Link>
          }
        />
      </div>
    );
  }

  const isOnline = peer?.isOnline ?? false;
  const showLastSeen = peer?.privacy.showLastSeen ?? true;
  const readReceipts = profile?.privacy.readReceipts ?? true;

  return (
    <div className="flex h-[100dvh] flex-col bg-brand-50 md:h-screen">
      {/* Top bar */}
      <header className="safe-top flex items-center gap-2 border-b border-brand-100 bg-white/95 px-2 py-2.5 backdrop-blur">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 text-ink-soft hover:bg-brand-50" aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        {peer && (
          <button onClick={() => setShowInfo(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Avatar src={peer.photoURL} name={peer.displayName} size={40} online={isOnline} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{peer.displayName}</p>
              <p className="truncate text-xs text-ink-muted">
                {isOnline
                  ? "Online"
                  : showLastSeen
                    ? formatLastSeen(peer.lastSeen, isOnline)
                    : "@" + peer.username}
              </p>
            </div>
          </button>
        )}
        <button onClick={() => setShowInfo(true)} className="rounded-full p-2 text-ink-soft hover:bg-brand-50" aria-label="Chat info">
          <MoreVertical size={20} />
        </button>
      </header>

      {notFriend && (
        <div className="bg-warning/10 px-4 py-2 text-center text-sm text-warning-700">
          You're not connected with this user. Messages are limited until you're friends.
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {visibleMessages.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">💬</span>}
            title="Say hello"
            description={`This is the start of your conversation with ${peer?.displayName ?? "this user"}. Messages disappear after 7 days.`}
          />
        ) : (
          visibleMessages.map((m: Message) => (
            <ChatBubble
              key={m.id}
              message={m}
              mine={m.senderId === profile!.uid}
              readReceiptsEnabled={readReceipts}
              onRetry={m.status === "failed" ? () => void retryMessage(m) : undefined}
            />
          ))
        )}
      </div>

      {/* Composer */}
      <MessageComposer
        onSendText={sendText}
        onSendMedia={sendMedia}
        disabled={notFriend || !peer}
        uploading={uploading}
      />

      {/* Info modal */}
      <Modal open={showInfo} onClose={() => setShowInfo(false)} title="Chat details">
        {peer && (
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <Avatar src={peer.photoURL} name={peer.displayName} size={72} online={isOnline} />
              <p className="mt-2 font-semibold text-ink">{peer.displayName}</p>
              <p className="text-sm text-ink-muted">@{peer.username}</p>
            </div>
            {peer.bio && <p className="text-center text-sm text-ink-soft">{peer.bio}</p>}
            <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
              Messages in this chat are automatically deleted after 7 days. Media is removed with its message.
            </div>
            <Button variant="outline" fullWidth onClick={() => navigate("/home")}>
              Back to chats
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
