import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, MessageSquare, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { ChatListSkeleton } from "@/components/ui/Skeleton";
import { useMyChats } from "@/hooks/useChats";
import { useAuth } from "@/context/AuthContext";
import { getProfile } from "@/services/profile";
import { getFriends } from "@/services/friends";
import { getOrCreateChat } from "@/services/chat";
import { formatChatTime } from "@/lib/time";
import { friendlyError } from "@/lib/errorMap";
import { useToast } from "@/components/ui/Toast";
import { useState, useEffect } from "react";
import type { UserProfile } from "@/lib/firebase/types";

export default function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { chats, loading } = useMyChats();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  const [peerProfiles, setPeerProfiles] = useState<Record<string, UserProfile>>({});

  // A friendship exists before a chat does. Load connections separately so
  // both people get a Chat button immediately after accepting a request.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setFriendsLoading(true);
    getFriends(profile.uid)
      .then((list) => {
        if (!cancelled) setFriends(list);
      })
      .catch((error) => {
        if (!cancelled) toast(friendlyError(error), "error");
      })
      .finally(() => {
        if (!cancelled) setFriendsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile, toast]);

  // Load peer profiles for display (names, avatars, online).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profile) return;
      const ids = new Set<string>();
      chats.forEach((c) => c.participants.forEach((p) => p !== profile.uid && ids.add(p)));
      const map: Record<string, UserProfile> = {};
      await Promise.all(
        [...ids].map(async (id) => {
          const p = await getProfile(id);
          if (p) map[id] = p;
        }),
      );
      if (!cancelled) setPeerProfiles(map);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [chats, profile]);

  async function openChat(friend: UserProfile) {
    if (!profile) return;
    setOpeningChat(friend.uid);
    try {
      const chat = await getOrCreateChat(profile, friend);
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      toast(friendlyError(error), "error");
    } finally {
      setOpeningChat(null);
    }
  }

  return (
    <AppShell>
      <MobileHeader title="Chats" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pt-4">
          <h1 className="text-2xl font-bold text-ink">Chats</h1>
          <Link to="/search" className="rounded-full bg-brand-50 p-2.5 text-brand-600 hover:bg-brand-100" aria-label="Search people">
            <Search size={20} />
          </Link>
        </div>

        {(friendsLoading || friends.length > 0) && (
          <section className="px-4 pt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Friends</h2>
              {!friendsLoading && <span className="text-xs text-ink-muted">{friends.length}</span>}
            </div>
            {friendsLoading ? (
              <div className="flex items-center justify-center rounded-2xl bg-white py-6 text-ink-muted shadow-soft">
                <Loader2 size={20} className="animate-spin" aria-label="Loading friends" />
              </div>
            ) : (
              <ul className="space-y-2">
                {friends.map((friend) => (
                  <li key={friend.uid} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
                    <Avatar src={friend.photoURL} name={friend.displayName} size={48} online={friend.isOnline} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{friend.displayName}</p>
                      <p className="truncate text-sm text-ink-muted">@{friend.username}</p>
                    </div>
                    <Button
                      size="sm"
                      loading={openingChat === friend.uid}
                      onClick={() => void openChat(friend)}
                      aria-label={`Chat with @${friend.username}`}
                    >
                      <MessageCircle size={16} />
                      <span className="hidden sm:inline">Chat</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {loading ? (
          <ChatListSkeleton />
        ) : chats.length === 0 ? (
          friends.length === 0 && !friendsLoading ? (
            <EmptyState
              icon={<MessageSquare size={28} />}
              title="No conversations yet"
              description="Find someone by username and start connecting. Messages disappear after 7 days."
              action={
                <Link to="/search" className="btn-primary">
                  Find people
                </Link>
              }
            />
          ) : (
            <p className="px-4 pb-4 pt-6 text-center text-sm text-ink-muted">
              Select a friend above to start chatting.
            </p>
          )
        ) : (
          <section className="flex-1 overflow-y-auto px-2 pb-2 pt-5">
            <h2 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Conversations</h2>
            <ul className="space-y-0.5">
            {chats.map((chat) => {
              const peerId = chat.participants.find((p) => p !== profile!.uid);
              const peer = peerId ? peerProfiles[peerId] : undefined;
              const unread = chat.unread[profile!.uid] ?? 0;
              const lastIsMine = chat.lastSenderId === profile!.uid;
              return (
                <li key={chat.id}>
                  <Link
                    to={`/chat/${chat.id}`}
                    className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-white"
                  >
                    <Avatar
                      src={peer?.photoURL}
                      name={peer?.displayName ?? chat.participantsUsernames[peerId ?? ""] ?? "User"}
                      size={52}
                      online={peer?.isOnline}
                      ring={unread > 0}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-ink">
                          {peer?.displayName ?? chat.participantsUsernames[peerId ?? ""] ?? "User"}
                        </p>
                        <span className="shrink-0 text-xs text-ink-muted">{formatChatTime(chat.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${unread > 0 ? "font-medium text-ink" : "text-ink-muted"}`}>
                          {lastIsMine && "You: "}
                          {chat.lastMessage || "No messages yet"}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
