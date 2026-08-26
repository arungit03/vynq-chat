import { privateMediaBucket, supabase } from "@/lib/supabase/client";
import { isoNow, Timestamp, toTimestamp } from "@/lib/time";
import type { ChatMediaKind, ChatMessage, ConversationMeta, MediaUploadTicket, PresenceState } from "@/lib/chat/types";

const MESSAGE_LIFETIME_MS = 24 * 60 * 60 * 1000;

type MessageRow = {
  id: string;
  sender_uid: string;
  type: "text" | "image" | "video";
  text: string | null;
  storage_path: string | null;
  content_type: string | null;
  bytes: number | null;
  duration_seconds: number | null;
  created_at: string | null;
  expires_at: string | null;
  read_at: string | null;
};

function messageFromRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    senderUid: row.sender_uid,
    type: row.type,
    text: row.text,
    storagePath: row.storage_path,
    contentType: row.content_type,
    bytes: row.bytes,
    durationSeconds: row.duration_seconds,
    createdAt: toTimestamp(row.created_at),
    expiresAt: toTimestamp(row.expires_at),
    readAt: toTimestamp(row.read_at),
  };
}

function conversationMetaFromRow(row: { id: string; member_uids: string[]; status: "active" | "closed"; last_message_at: string | null; last_message_preview: string | null; updated_at: string | null }): ConversationMeta {
  return {
    id: row.id,
    memberUids: row.member_uids,
    status: row.status,
    lastMessageAt: toTimestamp(row.last_message_at),
    lastMessagePreview: row.last_message_preview,
    updatedAt: toTimestamp(row.updated_at),
  };
}

export function listenToMessages(conversationId: string, onMessages: (messages: ChatMessage[]) => void, onError: (error: Error) => void) {
  const refresh = async () => {
    const { data, error } = await supabase.from("messages").select("id, sender_uid, type, text, storage_path, content_type, bytes, duration_seconds, created_at, expires_at, read_at").eq("conversation_id", conversationId).eq("upload_status", "ready").gt("expires_at", isoNow()).order("created_at", { ascending: true });
    if (error) onError(error);
    else onMessages((data as MessageRow[]).map(messageFromRow));
  };
  void refresh();
  const channel = supabase.channel(`messages:${conversationId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => void refresh()).subscribe((status) => {
    if (status === "CHANNEL_ERROR") onError(new Error("Realtime messages are unavailable."));
  });
  return () => { void supabase.removeChannel(channel); };
}

export function listenToConversationMeta(conversationId: string, onMeta: (meta: ConversationMeta | null) => void, onError: (error: Error) => void) {
  const refresh = async () => {
    const { data, error } = await supabase.from("conversations").select("id, member_uids, status, last_message_at, last_message_preview, updated_at").eq("id", conversationId).maybeSingle();
    if (error) onError(error);
    else onMeta(data ? conversationMetaFromRow(data as Parameters<typeof conversationMetaFromRow>[0]) : null);
  };
  void refresh();
  const channel = supabase.channel(`conversation:${conversationId}`).on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, () => void refresh()).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function sendTextMessage(conversationId: string, text: string) {
  const { data, error } = await supabase.rpc("send_message", { p_conversation_id: conversationId, p_text: text.trim() });
  if (error) throw error;
  return { data: { messageId: String(data) } };
}

export async function createMediaUpload(conversationId: string, media: { kind: ChatMediaKind; contentType: string; bytes: number; durationSeconds: number | null }) {
  const { data, error } = await supabase.rpc("create_media_message", { p_conversation_id: conversationId, p_type: media.kind, p_content_type: media.contentType, p_bytes: media.bytes, p_duration: media.durationSeconds });
  if (error) throw error;
  return data as MediaUploadTicket;
}

export async function finalizeMediaUpload(_conversationId: string, messageId: string) {
  const { data, error } = await supabase.rpc("finalize_media_message", { p_message_id: messageId });
  if (error) throw error;
  return data as { messageId: string };
}

export async function abortMediaUpload(_conversationId: string, messageId: string) {
  const { data, error } = await supabase.rpc("abort_media_message", { p_message_id: messageId });
  if (error) throw error;
  const storagePath = (data as { storagePath?: string | null })?.storagePath;
  if (storagePath) await supabase.storage.from(privateMediaBucket).remove([storagePath]);
  return { cancelled: true as const };
}

export async function markMessageRead(_conversationId: string, messageId: string) {
  const { error } = await supabase.from("messages").update({ read_at: isoNow() }).eq("id", messageId);
  if (error) throw error;
}

export function listenToPresence(uid: string, onPresence: (presence: PresenceState | null) => void, onError: (error: Error) => void) {
  const publish = (data: { state?: string; last_changed?: string } | null) => {
    if (!data || (data.state !== "online" && data.state !== "offline")) return onPresence(null);
    onPresence({ state: data.state, lastChanged: toTimestamp(data.last_changed)?.toMillis() });
  };
  void supabase.from("presence").select("state, last_changed").eq("uid", uid).maybeSingle().then(({ data, error }) => {
    if (error) onError(error); else publish(data as { state?: string; last_changed?: string } | null);
  });
  const channel = supabase.channel(`presence:${uid}`).on("postgres_changes", { event: "*", schema: "public", table: "presence", filter: `uid=eq.${uid}` }, (payload) => publish((payload.new ?? null) as { state?: string; last_changed?: string } | null)).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function startPresence(uid: string) {
  const mark = () => void supabase.from("presence").upsert({ uid, state: "online", last_changed: isoNow() });
  const offline = () => void supabase.from("presence").upsert({ uid, state: "offline", last_changed: isoNow() });
  mark();
  const timer = window.setInterval(mark, 30_000);
  window.addEventListener("pagehide", offline);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("pagehide", offline);
    offline();
  };
}

export function listenToTyping(conversationId: string, uid: string, onTyping: (typing: boolean) => void, onError: (error: Error) => void) {
  const publish = (data: { is_typing?: boolean; updated_at?: string } | null) => onTyping(Boolean(data?.is_typing) && Date.now() - (toTimestamp(data?.updated_at)?.toMillis() ?? Date.now()) < 5000);
  void supabase.from("typing").select("is_typing, updated_at").eq("conversation_id", conversationId).eq("uid", uid).maybeSingle().then(({ data, error }) => {
    if (error) onError(error); else publish(data as { is_typing?: boolean; updated_at?: string } | null);
  });
  const channel = supabase.channel(`typing:${conversationId}:${uid}`).on("postgres_changes", { event: "*", schema: "public", table: "typing", filter: `conversation_id=eq.${conversationId}` }, (payload) => publish((payload.new ?? null) as { is_typing?: boolean; updated_at?: string } | null)).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function setTyping(conversationId: string, uid: string, isTyping: boolean) {
  if (!isTyping) {
    const { error } = await supabase.from("typing").delete().eq("conversation_id", conversationId).eq("uid", uid);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("typing").upsert({ conversation_id: conversationId, uid, is_typing: true, updated_at: isoNow() });
  if (error) throw error;
}

export function formatChatTime(timestamp: Timestamp | null) {
  if (!timestamp) return "Sending...";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp.toDate());
}

export function formatLastSeen(timestamp?: number) {
  if (!timestamp) return "Offline";
  const age = Date.now() - timestamp;
  if (age < 90_000) return "Active recently";
  if (age < 60 * 60 * 1000) return `Last seen ${Math.max(1, Math.round(age / 60_000))}m ago`;
  return `Last seen ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp))}`;
}

export { MESSAGE_LIFETIME_MS };
