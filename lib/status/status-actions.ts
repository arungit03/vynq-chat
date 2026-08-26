import { privateMediaBucket, supabase } from "@/lib/supabase/client";
import { isoNow, toTimestamp } from "@/lib/time";
import type { ChatMediaKind } from "@/lib/chat/types";
import type { StatusUploadTicket, StoryStatus } from "@/lib/status/types";

type StatusRow = {
  id: string;
  owner_uid: string;
  type: ChatMediaKind;
  storage_path: string;
  content_type: string;
  bytes: number;
  duration_seconds: number | null;
  created_at: string | null;
  expires_at: string | null;
};

function newestFirst(statuses: StoryStatus[]) {
  return [...statuses].sort((left, right) => (right.createdAt?.toMillis() ?? 0) - (left.createdAt?.toMillis() ?? 0));
}

export function listenToStatusFeed(ownerUids: string[], onStatuses: (statuses: StoryStatus[]) => void, onError: (error: Error) => void) {
  const owners = Array.from(new Set(ownerUids.filter(Boolean)));
  const refresh = async () => {
    if (!owners.length) return onStatuses([]);
    const [{ data, error }, { data: profiles, error: profileError }] = await Promise.all([
      supabase.from("statuses").select("id, owner_uid, type, storage_path, content_type, bytes, duration_seconds, created_at, expires_at").in("owner_uid", owners).eq("upload_status", "ready").gt("expires_at", isoNow()).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, username, display_name").in("id", owners),
    ]);
    if (error || profileError) return onError(error || profileError || new Error("Status profiles could not be loaded."));
    const profileMap = new Map((profiles as Array<{ id: string; username: string | null; display_name: string | null }>).map((profile) => [profile.id, profile]));
    onStatuses(newestFirst((data as StatusRow[]).map((row) => {
      const profile = profileMap.get(row.owner_uid);
      return {
        id: row.id,
        ownerUid: row.owner_uid,
        ownerDisplayName: profile?.display_name || "Vynq member",
        ownerUsername: profile?.username || "member",
        type: row.type,
        storagePath: row.storage_path,
        contentType: row.content_type,
        bytes: row.bytes,
        durationSeconds: row.duration_seconds,
        createdAt: toTimestamp(row.created_at),
        expiresAt: toTimestamp(row.expires_at),
      };
    })));
  };
  void refresh();
  const channel = supabase.channel(`statuses:${owners.join("-")}`).on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, () => void refresh()).subscribe((status) => {
    if (status === "CHANNEL_ERROR") onError(new Error("Realtime statuses are unavailable."));
  });
  return () => { void supabase.removeChannel(channel); };
}

export async function createStatusUpload(media: { kind: ChatMediaKind; contentType: string; bytes: number; durationSeconds: number | null }) {
  const { data, error } = await supabase.rpc("create_status", { p_type: media.kind, p_content_type: media.contentType, p_bytes: media.bytes, p_duration: media.durationSeconds });
  if (error) throw error;
  return data as StatusUploadTicket;
}

export async function finalizeStatusUpload(statusId: string) {
  const { data, error } = await supabase.rpc("finalize_status", { p_status_id: statusId });
  if (error) throw error;
  return data as { statusId: string };
}

export async function abortStatusUpload(statusId: string) {
  const { data, error } = await supabase.rpc("abort_status", { p_status_id: statusId });
  if (error) throw error;
  const storagePath = (data as { storagePath?: string | null })?.storagePath;
  if (storagePath) await supabase.storage.from(privateMediaBucket).remove([storagePath]);
  return { cancelled: true as const };
}

export async function deleteStatus(statusId: string) {
  const { data, error } = await supabase.rpc("delete_status", { p_status_id: statusId });
  if (error) throw error;
  return data as { deleted: true };
}

export async function markStatusSeen(statusId: string, currentUid: string) {
  const { error } = await supabase.from("status_viewers").upsert({ status_id: statusId, viewer_uid: currentUid, seen_at: isoNow() }, { onConflict: "status_id,viewer_uid", ignoreDuplicates: true });
  if (error) throw error;
}

export async function getSeenStatusIds(statusIds: string[], currentUid: string) {
  if (!statusIds.length) return new Set<string>();
  const { data, error } = await supabase.from("status_viewers").select("status_id").eq("viewer_uid", currentUid).in("status_id", statusIds);
  if (error) throw error;
  return new Set((data as Array<{ status_id: string }>).map((row) => row.status_id));
}

export async function getStatusViewerCount(statusId: string) {
  const { count, error } = await supabase.from("status_viewers").select("viewer_uid", { count: "exact", head: true }).eq("status_id", statusId);
  if (error) throw error;
  return count ?? 0;
}

export function getStatusErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "22023": "Choose a supported image, MP4, or WebM file.",
    "42501": "Verify your email before sharing a status.",
    P0002: "This status is no longer available.",
    "23505": "This status is already being shared.",
  };
  return messages[code] || (error instanceof Error && error.message ? error.message : "Status could not be shared. Try again.");
}
