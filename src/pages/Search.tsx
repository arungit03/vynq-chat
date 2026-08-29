import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Loader2, AtSign } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import { UserCard, type RelationState } from "@/components/UserCard";
import { useRelations } from "@/hooks/useRelations";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { searchUsersByUsername } from "@/services/profile";
import { getIncomingRequests, getOutgoingRequests, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, type FriendRequest } from "@/services/friends";
import { friendlyError } from "@/lib/errorMap";
import type { UserProfile } from "@/lib/firebase/types";

export default function Search() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const [inc, out] = await Promise.all([getIncomingRequests(profile.uid), getOutgoingRequests(profile.uid)]);
        setIncoming(inc);
        setOutgoing(out);
      } catch (e) {
        toast(friendlyError(e), "error");
      }
    })();
  }, [profile, toast]);

  const uids = useMemo(() => results.map((r) => r.uid), [results]);
  const { relations, setRelation } = useRelations(uids);

  // Debounced search
  useEffect(() => {
    const t = term.trim();
    if (!t) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const res = await searchUsersByUsername(t, 20);
        setResults(res.filter((u) => u.uid !== profile?.uid));
        setSearched(true);
      } catch (e) {
        toast(friendlyError(e), "error");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [term, profile, toast]);

  const hasRequests = incoming.length > 0 || outgoing.length > 0;

  return (
    <AppShell>
      <MobileHeader title="Search" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="px-4 pt-4">
          <h1 className="mb-3 text-2xl font-bold text-ink">Search</h1>
          <Input
            placeholder="Search username…"
            leftIcon={<AtSign size={18} />}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Search username"
          />
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-4 pb-4">
          {/* Friend requests section */}
          {!term && hasRequests && (
            <section className="mb-5">
              <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">Friend requests</h2>
              {incoming.map((req) => (
                <RequestRow
                  key={req.id}
                  request={req}
                  direction="incoming"
                  onAccept={() => {
                    setIncoming((p) => p.filter((r) => r.id !== req.id));
                    setRelation(req.senderId, "friends");
                  }}
                  onReject={() => setIncoming((p) => p.filter((r) => r.id !== req.id))}
                />
              ))}
              {outgoing.map((req) => (
                <RequestRow
                  key={req.id}
                  request={req}
                  direction="outgoing"
                  onCancel={() => setOutgoing((p) => p.filter((r) => r.id !== req.id))}
                />
              ))}
            </section>
          )}

          {/* Search results */}
          {searching && (
            <div className="flex justify-center py-10 text-ink-muted">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}

          {!searching && searched && results.length === 0 && (
            <EmptyState
              icon={<SearchIcon size={26} />}
              title="No people found"
              description={`We couldn't find anyone named "@${term}". Try another username.`}
            />
          )}

          {!searched && !term && !hasRequests && (
            <EmptyState
              icon={<AtSign size={26} />}
              title="Search for people"
              description="Find friends by their @username and send a follow request."
            />
          )}

          <div className="space-y-2">
            {results.map((u) => (
              <UserCard
                key={u.uid}
                user={u}
                relation={(relations[u.uid] ?? "none") as RelationState}
                onRelationChange={(s) => setRelation(u.uid, s)}
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function RequestRow({
  request,
  direction,
  onAccept,
  onReject,
  onCancel,
}: {
  request: FriendRequest;
  direction: "incoming" | "outgoing";
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const isIncoming = direction === "incoming";
  const other = isIncoming
    ? { uid: request.senderId, username: request.senderUsername, displayName: request.senderDisplayName, photoURL: request.senderPhotoURL }
    : { uid: request.receiverId, username: request.receiverUsername, displayName: "", photoURL: "" };

  async function accept() {
    setBusy(true);
    try {
      await acceptFriendRequest(request);
      onAccept?.();
    } catch (e) {
      toast(friendlyError(e), "error");
      setBusy(false);
    }
  }
  async function reject() {
    setBusy(true);
    try {
      await rejectFriendRequest(request);
      onReject?.();
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await cancelFriendRequest(request);
      onCancel?.();
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
      <AvatarOrPlaceholder username={other.username} displayName={other.displayName} photoURL={other.photoURL} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">@{other.username}</p>
        <p className="truncate text-sm text-ink-muted">
          {isIncoming ? "Wants to connect" : "Request sent"}
        </p>
      </div>
      {isIncoming ? (
        <div className="flex gap-1.5">
          <button onClick={accept} disabled={busy} className="btn-primary px-3 py-2 text-sm">
            Accept
          </button>
          <button onClick={reject} disabled={busy} className="btn-ghost px-3 py-2 text-sm">
            Reject
          </button>
        </div>
      ) : (
        <button onClick={cancel} disabled={busy} className="btn-outline px-3 py-2 text-sm">
          Cancel
        </button>
      )}
    </div>
  );
}

function AvatarOrPlaceholder({ username, displayName, photoURL }: { username: string; displayName: string; photoURL: string }) {
  // small inline avatar to avoid importing Avatar with non-user shape
  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700">
      {photoURL ? (
        <img src={photoURL} alt={username} className="h-full w-full object-cover" />
      ) : (
        <span>{(displayName || username).slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
