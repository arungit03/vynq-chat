import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatStatusTime } from "@/lib/time";
import type { Status } from "@/lib/firebase/types";
import { markStatusViewed } from "@/services/status";

interface StatusViewerProps {
  statuses: Status[];
  startIndex: number;
  myId: string;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export function StatusViewer({ statuses, startIndex, myId, onClose, onNavigate }: StatusViewerProps) {
  const [index, setIndex] = useState(startIndex);
  const current = statuses[index];
  const [progress, setProgress] = useState(0);

  // Mark viewed
  useEffect(() => {
    if (current && current.ownerId !== myId) markStatusViewed(current, myId).catch(() => {});
  }, [current, myId]);

  // Auto-advance for images (videos controlled by player)
  useEffect(() => {
    if (!current) return;
    setProgress(0);
    if (current.type === "video") return;
    const duration = 5000;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else goNext();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function goNext() {
    if (index < statuses.length - 1) {
      const ni = index + 1;
      setIndex(ni);
      onNavigate?.(ni);
    } else onClose();
  }
  function goPrev() {
    if (index > 0) {
      const pi = index - 1;
      setIndex(pi);
      onNavigate?.(pi);
    }
  }

  if (!current) return null;

  const canPrev = index > 0;
  const canNext = index < statuses.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 animate-fade-in" role="dialog" aria-modal="true">
      {/* Progress bar */}
      <div className="absolute left-0 right-0 top-0 flex gap-1 p-3">
        {statuses.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className={`h-full bg-white ${i < index ? "w-full" : i === index ? "" : "w-0"}`} style={i === index ? { width: `${progress * 100}%` } : undefined} />
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-4 flex items-center gap-3 px-4 pt-2 text-white">
        <Avatar src={current.ownerPhotoURL} name={current.ownerDisplayName} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{current.ownerDisplayName}</p>
          <p className="truncate text-xs text-white/70">{formatStatusTime(current.createdAt)}</p>
        </div>
        <button onClick={onClose} className="ml-auto rounded-full p-2 hover:bg-white/10" aria-label="Close status">
          <X size={22} />
        </button>
      </div>

      {/* Media */}
      <div className="flex max-h-[80vh] max-w-full items-center justify-center px-2">
        {current.type === "image" ? (
          <img src={current.mediaURL} alt="Status" className="max-h-[80vh] max-w-full rounded-xl object-contain" />
        ) : (
          <video src={current.mediaURL} autoPlay controls className="max-h-[80vh] max-w-full rounded-xl bg-black object-contain" />
        )}
      </div>
      {current.text && (
        <p className="absolute bottom-20 left-0 right-0 px-6 text-center text-sm text-white/90">{current.text}</p>
      )}

      {/* Nav arrows */}
      {canPrev && (
        <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous status">
          <ChevronLeft size={24} />
        </button>
      )}
      {canNext && (
        <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next status">
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}
