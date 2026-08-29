import { useState } from "react";
import { Check, Inbox, Loader2, UserRoundPlus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Avatar } from "@/components/ui/Avatar";
import { useIncomingRequests } from "@/hooks/useIncomingRequests";
import { acceptFriendRequest, rejectFriendRequest } from "@/services/friends";
import { useToast } from "@/components/ui/Toast";
import { friendlyError } from "@/lib/errorMap";
import type { FriendRequest } from "@/lib/firebase/types";

export default function Requests() {
  const { requests, loading } = useIncomingRequests();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const visibleRequests = requests.filter((request) => !handledIds.has(request.id));

  function removeRequest(id: string) {
    setHandledIds((current) => new Set(current).add(id));
  }

  async function respond(request: FriendRequest, action: "accept" | "reject") {
    setBusyId(request.id);
    try {
      if (action === "accept") {
        await acceptFriendRequest(request);
        toast(`You're connected with @${request.senderUsername}`, "success");
      } else {
        await rejectFriendRequest(request);
        toast("Request declined.", "info");
      }
      removeRequest(request.id);
    } catch (error) {
      toast(friendlyError(error), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <MobileHeader title="Requests" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <UserRoundPlus size={21} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Requests</h1>
              <p className="text-sm text-ink-muted">People who want to connect with you.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-5">
          {loading && (
            <div className="flex justify-center py-10 text-ink-muted">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}

          {!loading && visibleRequests.length === 0 && (
            <EmptyState
              icon={<Inbox size={26} />}
              title="No pending requests"
              description="New connection requests will appear here."
            />
          )}

          <div className="space-y-2">
            {visibleRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                busy={busyId === request.id}
                onAccept={() => void respond(request, "accept")}
                onReject={() => void respond(request, "reject")}
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
  busy,
  onAccept,
  onReject,
}: {
  request: FriendRequest;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
      <Avatar
        src={request.senderPhotoURL}
        name={request.senderDisplayName || request.senderUsername}
        size={48}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{request.senderDisplayName}</p>
        <p className="truncate text-sm text-ink-muted">@{request.senderUsername} wants to connect</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" loading={busy} onClick={onAccept} aria-label={`Accept @${request.senderUsername}`}>
          <Check size={16} />
          <span className="hidden sm:inline">Accept</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onReject}
          aria-label={`Decline @${request.senderUsername}`}
        >
          <X size={16} />
          <span className="hidden sm:inline">Decline</span>
        </Button>
      </div>
    </div>
  );
}
