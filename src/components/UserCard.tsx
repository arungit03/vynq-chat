import { useState } from "react";
import { UserPlus, UserCheck, Clock, Check, X, UserX } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getRelation,
} from "@/services/friends";
import type { FriendRequest } from "@/lib/firebase/types";
import { friendlyError } from "@/lib/errorMap";
import type { UserProfile } from "@/lib/firebase/types";

export type RelationState = "none" | "pending_out" | "pending_in" | "friends" | "blocked";

interface UserCardProps {
  user: UserProfile;
  relation: RelationState;
  onRelationChange?: (state: RelationState) => void;
}

export function UserCard({ user, relation, onRelationChange }: UserCardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!profile || profile.uid === user.uid) {
    // Self: show profile only (no actions).
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
        <Avatar src={user.photoURL} name={user.displayName} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{user.displayName}</p>
          <p className="truncate text-sm text-ink-muted">@{user.username}</p>
        </div>
      </div>
    );
  }

  async function handleSend() {
    setBusy(true);
    try {
      await sendFriendRequest(profile!, user);
      onRelationChange?.("pending_out");
      toast(`Request sent to @${user.username}`, "success");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    setBusy(true);
    try {
      const rel = await getRelation(profile!.uid, user.uid);
      if (rel.request) {
        await acceptFriendRequest(rel.request as FriendRequest);
      }
      onRelationChange?.("friends");
      toast(`You're connected with @${user.username}`, "success");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      const rel = await getRelation(profile!.uid, user.uid);
      if (rel.request) await rejectFriendRequest(rel.request as FriendRequest);
      onRelationChange?.("none");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      const rel = await getRelation(profile!.uid, user.uid);
      if (rel.request) await cancelFriendRequest(rel.request as FriendRequest);
      onRelationChange?.("none");
      toast("Request cancelled", "info");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft animate-fade-in">
      <Avatar src={user.photoURL} name={user.displayName} size={48} online={user.isOnline} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{user.displayName}</p>
        <p className="truncate text-sm text-ink-muted">@{user.username}</p>
        {user.bio && <p className="mt-0.5 line-clamp-1 truncate text-xs text-ink-muted">{user.bio}</p>}
      </div>

      <div className="shrink-0">
        {relation === "friends" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
            <UserCheck size={16} /> Following
          </span>
        )}
        {relation === "pending_out" && (
          <Button size="sm" variant="outline" loading={busy} onClick={handleCancel}>
            <Clock size={15} /> Requested
          </Button>
        )}
        {relation === "pending_in" && (
          <div className="flex gap-1.5">
            <Button size="sm" loading={busy} onClick={handleAccept} aria-label="Accept request">
              <Check size={16} />
            </Button>
            <Button size="sm" variant="ghost" loading={busy} onClick={handleReject} aria-label="Reject request">
              <X size={16} />
            </Button>
          </div>
        )}
        {relation === "blocked" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink-muted/10 px-3 py-1.5 text-sm text-ink-muted">
            <UserX size={15} /> Blocked
          </span>
        )}
        {relation === "none" && (
          <Button size="sm" loading={busy} onClick={handleSend}>
            <UserPlus size={16} /> Follow
          </Button>
        )}
      </div>
    </div>
  );
}
