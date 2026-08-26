"use client";

import { useEffect, useState } from "react";
import { ImageOff, LoaderCircle, Play } from "lucide-react";
import { privateMediaBucket, supabase } from "@/lib/supabase/client";
import type { StoryStatus } from "@/lib/status/types";

export default function SecureStatusMedia({ status, variant = "tile", autoPlay = false }: { status: StoryStatus; variant?: "tile" | "viewer"; autoPlay?: boolean }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;
    void supabase.storage.from(privateMediaBucket).download(status.storagePath)
      .then(({ data, error }) => {
        if (error || !data) throw error ?? new Error("Media unavailable");
        const blob = data;
        currentUrl = URL.createObjectURL(blob);
        if (active) {
          setFailed(false);
          setObjectUrl(currentUrl);
        } else {
          URL.revokeObjectURL(currentUrl);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [status.storagePath]);

  const frameClass = variant === "viewer" ? "h-full w-full object-contain" : "h-full w-full object-cover";
  if (failed) {
    return <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-soft text-ink-faint"><ImageOff className="h-5 w-5" /><span className="text-[10px] font-semibold">Status unavailable</span></div>;
  }
  if (!objectUrl) {
    return <div className="flex h-full w-full items-center justify-center bg-surface-soft text-brand"><LoaderCircle className="h-5 w-5 animate-spin" /></div>;
  }
  if (status.type === "video") {
    return <div className="relative h-full w-full bg-ink">
      <video src={objectUrl} autoPlay={autoPlay} muted={autoPlay} controls={variant === "viewer"} playsInline preload="metadata" className={frameClass} />
      {variant === "tile" ? <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand shadow-float"><Play className="ml-0.5 h-4 w-4 fill-brand" /></span> : null}
    </div>;
  }
  return <>
    {/* Authenticated Storage blobs are held in memory and never written to disk by the app. */}
    <img src={objectUrl} alt={`${status.ownerDisplayName}'s status`} className={frameClass} />
  </>;
}
