"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, FileImage, LoaderCircle, Paperclip, Send, Video, X } from "lucide-react";
import { abortMediaUpload, createMediaUpload, finalizeMediaUpload } from "@/lib/chat/chat-actions";
import { formatMediaSize, prepareMedia, type PreparedMedia } from "@/lib/chat/media";
import { privateMediaBucket, supabase } from "@/lib/supabase/client";
import type { MediaUploadTicket } from "@/lib/chat/types";
import { useModalFocus } from "@/lib/ui/use-modal-focus";

type Draft = PreparedMedia & { previewUrl: string };

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Media could not be prepared. Try another file.";
}

export default function ChatMediaComposer({ conversationId, disabled, onError }: { conversationId: string; disabled?: boolean; onError: (message: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const imageInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const activeTicket = useRef<MediaUploadTicket | null>(null);
  const cancelled = useRef(false);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const clearDraft = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setDraft(null);
    setProgress(0);
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPickerOpen(false);
    setPreparing(true);
    onError("");
    try {
      const prepared = await prepareMedia(file);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      const nextPreviewUrl = URL.createObjectURL(prepared.file);
      previewUrl.current = nextPreviewUrl;
      setDraft({ ...prepared, previewUrl: nextPreviewUrl });
    } catch (error) {
      onError(errorText(error));
    } finally {
      setPreparing(false);
    }
  };

  const cancelUpload = () => {
    cancelled.current = true;
    const ticket = activeTicket.current;
    if (ticket) void abortMediaUpload(conversationId, ticket.messageId);
    activeTicket.current = null;
    clearDraft();
    setUploading(false);
  };

  const sendMedia = async () => {
    if (!draft || uploading) return;
    cancelled.current = false;
    setUploading(true);
    setProgress(0);
    onError("");
    let ticket: MediaUploadTicket | null = null;
    try {
      ticket = await createMediaUpload(conversationId, {
        kind: draft.kind,
        contentType: draft.file.type,
        bytes: draft.file.size,
        durationSeconds: draft.durationSeconds,
      });
      activeTicket.current = ticket;
      setProgress(20);
      const { error: uploadError } = await supabase.storage.from(privateMediaBucket).upload(ticket.storagePath, draft.file, {
        contentType: draft.file.type,
        cacheControl: "0",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      setProgress(100);
      await finalizeMediaUpload(conversationId, ticket.messageId);
      activeTicket.current = null;
      clearDraft();
    } catch (error) {
      if (ticket) void abortMediaUpload(conversationId, ticket.messageId);
      activeTicket.current = null;
      if (!cancelled.current) onError(errorText(error));
    } finally {
      setUploading(false);
    }
  };

  const dialogRef = useModalFocus(Boolean(draft), uploading ? cancelUpload : clearDraft);

  return (
    <div className="relative shrink-0">
      <input ref={imageInput} onChange={(event) => void chooseFile(event)} accept="image/jpeg,image/png,image/webp" className="hidden" type="file" />
      <input ref={cameraInput} onChange={(event) => void chooseFile(event)} accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" type="file" />
      <input ref={videoInput} onChange={(event) => void chooseFile(event)} accept="video/mp4,video/webm" capture="environment" className="hidden" type="file" />
      <button type="button" disabled={disabled || preparing || uploading} onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen} aria-label="Attach private media" className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] text-ink-soft transition hover:bg-brand-pale hover:text-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50">
        {preparing ? <LoaderCircle className="h-[17px] w-[17px] animate-spin" /> : <Paperclip className="h-[17px] w-[17px]" />}
      </button>

      {pickerOpen ? <div className="absolute bottom-[calc(100%+0.65rem)] left-0 z-30 w-52 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-float">
        <button type="button" onClick={() => imageInput.current?.click()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold text-ink transition hover:bg-brand-pale hover:text-brand-strong"><FileImage className="h-4 w-4 text-brand" /> Image</button>
        <button type="button" onClick={() => cameraInput.current?.click()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold text-ink transition hover:bg-brand-pale hover:text-brand-strong"><Camera className="h-4 w-4 text-brand" /> Use camera</button>
        <button type="button" onClick={() => videoInput.current?.click()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold text-ink transition hover:bg-brand-pale hover:text-brand-strong"><Video className="h-4 w-4 text-brand" /> Video <span className="ml-auto text-[9px] font-semibold text-ink-faint">30s max</span></button>
      </div> : null}

      {draft ? <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Media preview" className="fixed inset-0 z-50 flex items-end justify-center bg-[#10203a]/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
        <div className="enter-up w-full max-w-md overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(22,49,88,0.3)]">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">Private media</p><h3 className="mt-1 text-[18px] font-bold tracking-[-0.04em] text-ink">Ready to send</h3></div>
            <button type="button" onClick={uploading ? cancelUpload : clearDraft} aria-label="Close media preview" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-pale hover:text-brand-strong"><X className="h-4 w-4" /></button>
          </div>
          <div className="mx-5 overflow-hidden rounded-[20px] bg-ink">
            {draft.kind === "image" ? <>
              {/* Object URLs are private, in-memory previews and stay in browser memory. */}
              <img src={draft.previewUrl} alt="Selected image preview" className="max-h-[52svh] w-full object-contain" />
            </> : <video src={draft.previewUrl} controls playsInline preload="metadata" className="max-h-[52svh] w-full" />}
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between text-[11px]"><span className="font-bold text-ink">{draft.kind === "image" ? "Compressed image" : "Video"}</span><span className="text-ink-soft">{formatMediaSize(draft.file.size)}{draft.durationSeconds ? ` · ${Math.ceil(draft.durationSeconds)}s` : ""}</span></div>
            <p className="mt-2 text-[10px] leading-4 text-ink-soft">Only this friend can open it. It disappears with the message after 24 hours.</p>
            {uploading ? <div className="mt-4"><div className="flex items-center justify-between text-[10px] font-bold text-brand-strong"><span>Uploading securely</span><span>{progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-pale"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} /></div></div> : null}
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={uploading} onClick={clearDraft} className="flex-1 rounded-2xl border border-line px-4 py-3 text-[11px] font-bold text-ink-soft transition hover:bg-surface-soft disabled:opacity-50">Remove</button>
              <button type="button" disabled={uploading} onClick={() => void sendMedia()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(92,141,246,0.25)] transition hover:bg-brand-strong disabled:opacity-65">{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{uploading ? "Uploading" : "Send privately"}</button>
            </div>
          </div>
        </div>
      </div> : null}
    </div>
  );
}
