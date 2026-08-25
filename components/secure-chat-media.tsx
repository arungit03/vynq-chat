"use client";

import { useEffect, useState } from "react";
import { Expand, ImageOff, LoaderCircle, Play, X } from "lucide-react";
import { getBlob, ref } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { formatMediaSize } from "@/lib/chat/media";
import type { ChatMessage } from "@/lib/chat/types";
import { useModalFocus } from "@/lib/ui/use-modal-focus";

function MediaFrame({ message, src, expanded }: { message: ChatMessage; src: string; expanded: boolean }) {
  if (message.type === "video") {
    return <video src={src} controls playsInline preload="metadata" className={expanded ? "max-h-[78svh] max-w-full rounded-2xl" : "h-auto max-h-72 w-full rounded-[15px] bg-ink object-cover"} />;
  }
  return <>
    {/* Object URLs come from authenticated Storage blobs, not a public image URL. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt="Shared image" className={expanded ? "max-h-[78svh] max-w-full rounded-2xl object-contain" : "h-auto max-h-80 w-full rounded-[15px] object-cover"} />
  </>;
}

export default function SecureChatMedia({ message }: { message: ChatMessage }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useModalFocus(expanded, () => setExpanded(false));

  useEffect(() => {
    if (!message.storagePath) return undefined;
    let active = true;
    let currentUrl: string | null = null;
    void getBlob(ref(storage, message.storagePath))
      .then((blob) => {
        currentUrl = URL.createObjectURL(blob);
        if (active) setObjectUrl(currentUrl);
        else URL.revokeObjectURL(currentUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [message.storagePath]);

  if (!message.storagePath || failed) {
    return <div className="flex h-36 w-52 flex-col items-center justify-center gap-2 rounded-[15px] bg-surface-soft text-ink-faint"><ImageOff className="h-5 w-5" /><span className="text-[10px] font-semibold">Media unavailable</span></div>;
  }

  if (!objectUrl) {
    return <div className="flex h-36 w-52 items-center justify-center rounded-[15px] bg-surface-soft text-brand"><LoaderCircle className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <>
      <button type="button" onClick={() => setExpanded(true)} aria-label="Open shared media" className="group relative block w-full overflow-hidden rounded-[15px] text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30">
        <MediaFrame message={message} src={objectUrl} expanded={false} />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/45 to-transparent px-3 pb-2 pt-8 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <span>{message.type === "video" && message.durationSeconds ? `${Math.ceil(message.durationSeconds)}s video` : "Image"}</span>
          <span className="flex items-center gap-1"><Expand className="h-3.5 w-3.5" /> Open</span>
        </span>
        {message.type === "video" ? <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand shadow-float"><Play className="ml-0.5 h-4 w-4 fill-brand" /></span> : null}
      </button>
      {expanded ? <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Shared media preview" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1d31]/90 p-4 backdrop-blur-sm">
        <button type="button" aria-label="Close media preview" onClick={() => setExpanded(false)} className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"><X className="h-5 w-5" /></button>
        <div className="flex max-h-full max-w-full flex-col items-center gap-3">
          <MediaFrame message={message} src={objectUrl} expanded />
          <p className="text-[11px] font-medium text-white/70">{message.bytes ? formatMediaSize(message.bytes) : "Private media"} · disappears with this message</p>
        </div>
      </div> : null}
    </>
  );
}
