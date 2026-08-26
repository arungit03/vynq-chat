import { supabase } from "@/lib/supabase/client";
import { toTimestamp } from "@/lib/time";
import type { FollowRequest, FollowRequestStatus, RelationshipStatus, SocialFriend, SocialProfile, SocialSnapshot } from "@/lib/social/types";

export const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  bio: string | null;
  created_at: string | null;
};

type RequestRow = {
  id: string;
  from_uid: string;
  to_uid: string;
  status: FollowRequestStatus;
  created_at: string | null;
  updated_at: string | null;
  responded_at: string | null;
};

function profileFromRow(row: ProfileRow): SocialProfile {
  return {
    uid: row.id,
    username: row.username ?? row.id.slice(0, 8),
    displayName: row.display_name || "Vynq member",
    avatarPath: row.avatar_path,
    bio: row.bio,
    createdAt: toTimestamp(row.created_at) ?? undefined,
  };
}

function requestFromRow(row: RequestRow): FollowRequest {
  return {
    id: row.id,
    fromUid: row.from_uid,
    toUid: row.to_uid,
    status: row.status,
    createdAt: toTimestamp(row.created_at) ?? undefined,
    updatedAt: toTimestamp(row.updated_at) ?? undefined,
    respondedAt: toTimestamp(row.responded_at) ?? undefined,
  };
}

function sortNewest<T extends { createdAt?: { toMillis?: () => number } }>(items: T[]) {
  return items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

async function profilesByUid(uids: string[]) {
  if (!uids.length) return new Map<string, SocialProfile>();
  const { data, error } = await supabase.from("profiles").select("id, username, display_name, avatar_path, bio, created_at").in("id", uids);
  if (error) throw error;
  return new Map((data as ProfileRow[]).map((row) => [row.id, profileFromRow(row)]));
}

export async function fetchProfileByUid(uid: string) {
  const { data, error } = await supabase.from("profiles").select("id, username, display_name, avatar_path, bio, created_at").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data && (data as ProfileRow).username ? profileFromRow(data as ProfileRow) : null;
}

export async function fetchProfileByUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) return null;
  const { data, error } = await supabase.from("profiles").select("id, username, display_name, avatar_path, bio, created_at").eq("username", normalized).maybeSingle();
  if (error) throw error;
  return data ? profileFromRow(data as ProfileRow) : null;
}

export async function fetchRelationship(currentUid: string, targetUid: string): Promise<RelationshipStatus> {
  if (currentUid === targetUid) return "self";
  const [friendships, outgoing, incoming] = await Promise.all([
    supabase.from("friendships").select("id, member_uids").contains("member_uids", [currentUid]),
    supabase.from("follow_requests").select("id, status").eq("from_uid", currentUid).eq("to_uid", targetUid).eq("status", "pending").maybeSingle(),
    supabase.from("follow_requests").select("id, status").eq("from_uid", targetUid).eq("to_uid", currentUid).eq("status", "pending").maybeSingle(),
  ]);
  const error = friendships.error || outgoing.error || incoming.error;
  if (error) throw error;
  const friend = (friendships.data as Array<{ member_uids: string[] }>).some((row) => row.member_uids.includes(targetUid));
  if (friend) return "friends";
  if (outgoing.data) return "requested";
  if (incoming.data) return "incoming";
  return "none";
}

export async function fetchSocialSnapshot(uid: string): Promise<SocialSnapshot> {
  const [profileResult, friendshipResult, incomingResult, outgoingResult] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_path, bio, created_at").eq("id", uid).maybeSingle(),
    supabase.from("friendships").select("id, member_uids").contains("member_uids", [uid]),
    supabase.from("follow_requests").select("id, from_uid, to_uid, status, created_at, updated_at, responded_at").eq("to_uid", uid),
    supabase.from("follow_requests").select("id, from_uid, to_uid, status, created_at, updated_at, responded_at").eq("from_uid", uid),
  ]);
  const error = profileResult.error || friendshipResult.error || incomingResult.error || outgoingResult.error;
  if (error) throw error;

  const profile = profileResult.data && (profileResult.data as ProfileRow).username ? profileFromRow(profileResult.data as ProfileRow) : null;
  const incomingRequests = sortNewest((incomingResult.data as RequestRow[]).map(requestFromRow).filter((request) => request.status === "pending"));
  const outgoingRequests = sortNewest((outgoingResult.data as RequestRow[]).map(requestFromRow).filter((request) => request.status === "pending"));
  const acceptedIncoming = (incomingResult.data as RequestRow[]).map(requestFromRow).filter((request) => request.status === "accepted");
  const acceptedOutgoing = (outgoingResult.data as RequestRow[]).map(requestFromRow).filter((request) => request.status === "accepted");
  const friendRows = (friendshipResult.data as Array<{ id: string; member_uids: string[] }>).flatMap((row) => {
    const friendUid = row.member_uids.find((memberUid) => memberUid !== uid);
    return friendUid ? [{ friendshipId: row.id, friendUid }] : [];
  });
  const profileUids = Array.from(new Set([
    ...friendRows.map((row) => row.friendUid),
    ...incomingRequests.map((request) => request.fromUid),
    ...outgoingRequests.map((request) => request.toUid),
    ...acceptedIncoming.map((request) => request.fromUid),
    ...acceptedOutgoing.map((request) => request.toUid),
  ]));
  const profiles = await profilesByUid(profileUids);
  const addProfile = (request: FollowRequest, uidKey: "fromUid" | "toUid") => ({ ...request, profile: profiles.get(request[uidKey]) ?? null });
  const friends: SocialFriend[] = friendRows.flatMap((row) => {
    const friend = profiles.get(row.friendUid);
    return friend ? [{ ...friend, friendshipId: row.friendshipId }] : [];
  });

  return {
    profile,
    friends,
    followers: acceptedIncoming.flatMap((request) => { const person = profiles.get(request.fromUid); return person ? [person] : []; }),
    following: acceptedOutgoing.flatMap((request) => { const person = profiles.get(request.toUid); return person ? [person] : []; }),
    incomingRequests: incomingRequests.map((request) => addProfile(request, "fromUid")),
    outgoingRequests: outgoingRequests.map((request) => addProfile(request, "toUid")),
  };
}

export async function sendFollowRequest(targetUid: string) {
  const { data, error } = await supabase.rpc("send_follow_request", { p_target_uid: targetUid });
  if (error) throw error;
  return { data: { requestId: String(data) } };
}

export async function respondToFollowRequest(requestId: string, decision: "accepted" | "rejected") {
  const { data, error } = await supabase.rpc("respond_to_follow_request", { p_request_id: requestId, p_decision: decision });
  if (error) throw error;
  return { data: data as { friendshipId?: string; status: string } };
}

export async function cancelFollowRequest(requestId: string) {
  const { data, error } = await supabase.rpc("cancel_follow_request", { p_request_id: requestId });
  if (error) throw error;
  return { data: data as { status: string } };
}

export function getSocialErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "23505": "This request is already active or you are already friends.",
    "22023": "Check the profile and try again.",
    "42501": "You need a verified email to manage connections.",
    P0002: "That profile or request no longer exists.",
  };
  return messages[code] || (error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.");
}
