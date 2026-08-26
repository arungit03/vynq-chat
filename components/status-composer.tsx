"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, FileImage, LoaderCircle, Send, Video, X } from "lucide-react";
import { privateMediaBucket, supabase } from "@/lib/supabase/client";
import { formatMediaSize, prepareMedia, type PreparedMedia } from "@/lib/chat/media";
import { abortStatusUpload, createStatusUpload, finalizeStatusUpload, getStatusErrorMessage } from "@/lib/status/status-actions";
import type { StatusUploadTicket } from "@/lib/status/types";
import { useModalFocus } from "@/lib/ui/use-modal-focus";

type Draft = PreparedMedia & { previewUrl: string };

export default function StatusComposer({ open, onClose, onShared, onError, error }: { open: boolean; onClose: () => void; onShared: () => void; onError: (message: string) => void; error?: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const imageInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const activeTicket = useRef<StatusUploadTicket | null>(null);
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

  const close = () => {
    if (uploading) {
      cancelled.current = true;
      if (activeTicket.current) void abortStatusUpload(activeTicket.current.statusId);
      activeTicket.current = null;
      setUploading(false);
    }
    clearDraft();
    onClose();
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreparing(true);
    onError("");
    try {
      const prepared = await prepareMedia(file);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      const nextPreviewUrl = URL.createObjectURL(prepared.file);
      previewUrl.current = nextPreviewUrl;
      setDraft({ ...prepared, previewUrl: nextPreviewUrl });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Media could not be prepared.");
    } finally {
      setPreparing(false);
    }
  };

  const share = async () => {
    if (!draft || uploading) return;
    cancelled.current = false;
    setUploading(true);
    setProgress(0);
    onError("");
    let ticket: StatusUploadTicket | null = null;
    try {
      ticket = await createStatusUpload({
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
      await finalizeStatusUpload(ticket.statusId);
      activeTicket.current = null;
      clearDraft();
      onShared();
      onClose();
    } catch (error) {
      if (ticket) void abortStatusUpload(ticket.statusId);
      activeTicket.current = null;
      if (!cancelled.current) onError(getStatusErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const dialogRef = useModalFocus(open, close);

  if (!open) return null;

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Create a status" className="fixed inset-0 z-50 flex items-end justify-center bg-[#10203a]/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <input ref={imageInput} onChange={(event) => void chooseFile(event)} accept="image/jpeg,image/png,image/webp" className="hidden" type="file" />
      <input ref={cameraInput} onChange={(event) => void chooseFile(event)} accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" type="file" />
      <input ref={videoInput} onChange={(event) => void chooseFile(event)} accept="video/mp4,video/webm" capture="environment" className="hidden" type="file" />
      <div className="enter-up w-full max-w-md overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(22,49,88,0.3)]">
        <div className="flex items-start justify-between px-5 pb-3 pt-5">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">Friends only</p><h2 className="mt-1 text-[20px] font-bold tracking-[-0.05em] text-ink">Share a status</h2></div>
          <button type="button" onClick={close} aria-label="Close status composer" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-pale hover:text-brand-strong"><X className="h-4 w-4" /></button>
        </div>
        {draft ? <>
          <div className="mx-5 overflow-hidden rounded-[20px] bg-ink">
            {draft.kind === "image" ? <>
              {/* Object URLs are private, in-memory previews and stay in browser memory. */}
              <img src={draft.previewUrl} alt="Selected status preview" className="max-h-[52svh] w-full object-contain" />
            </> : <video src={draft.previewUrl} controls playsInline preload="metadata" className="max-h-[52svh] w-full" />}
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between text-[11px]"><span className="font-bold text-ink">{draft.kind === "image" ? "Compressed image" : "Video"}</span><span className="text-ink-soft">{formatMediaSize(draft.file.size)}{draft.durationSeconds ? ` · ${Math.ceil(draft.durationSeconds)}s` : ""}</span></div>
            <p className="mt-2 text-[10px] leading-4 text-ink-soft">Only accepted friends can view this. It disappears after 24 hours.</p>
            {error ? <p role="alert" className="mt-3 rounded-xl border border-[#f3c7c7] bg-[#fff5f5] px-3 py-2 text-[10px] font-semibold leading-4 text-[#b74d56]">{error}</p> : null}
            {uploading ? <div className="mt-4"><div className="flex items-center justify-between text-[10px] font-bold text-brand-strong"><span>Uploading securely</span><span>{progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-pale"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} /></div></div> : null}
            <div className="mt-5 flex gap-2"><button type="button" disabled={uploading} onClick={clearDraft} className="flex-1 rounded-2xl border border-line px-4 py-3 text-[11px] font-bold text-ink-soft hover:bg-surface-soft disabled:opacity-50">Choose another</button><button type="button" disabled={uploading} onClick={() => void share()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(92,141,246,0.25)] hover:bg-brand-strong disabled:opacity-65">{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{uploading ? "Uploading" : "Share"}</button></div>
          </div>
        </> : <div className="px-5 pb-5 pt-3"><p className="text-[11px] leading-5 text-ink-soft">Choose a photo or a short video. Browser or device camera permission is requested only after you choose an action.</p>{error ? <p role="alert" className="mt-3 rounded-xl border border-[#f3c7c7] bg-[#fff5f5] px-3 py-2 text-[10px] font-semibold leading-4 text-[#b74d56]">{error}</p> : null}<div className="mt-5 grid grid-cols-3 gap-2"><button type="button" disabled={preparing} onClick={() => imageInput.current?.click()} className="flex h-28 flex-col items-center justify-center gap-2 rounded-[20px] bg-surface-soft text-ink-soft transition hover:bg-brand-pale hover:text-brand-strong disabled:opacity-55">{preparing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileImage className="h-5 w-5 text-brand" />}<span className="text-[10px] font-bold">Image</span></button><button type="button" disabled={preparing} onClick={() => cameraInput.current?.click()} className="flex h-28 flex-col items-center justify-center gap-2 rounded-[20px] bg-surface-soft text-ink-soft transition hover:bg-brand-pale hover:text-brand-strong disabled:opacity-55"><Camera className="h-5 w-5 text-brand" /><span className="text-[10px] font-bold">Camera</span></button><button type="button" disabled={preparing} onClick={() => videoInput.current?.click()} className="flex h-28 flex-col items-center justify-center gap-2 rounded-[20px] bg-surface-soft text-ink-soft transition hover:bg-brand-pale hover:text-brand-strong disabled:opacity-55"><Video className="h-5 w-5 text-brand" /><span className="text-[10px] font-bold">Video · 30s</span></button></div></div>}
      </div>
    </div>
  );
}
