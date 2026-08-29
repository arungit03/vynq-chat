import { useRef, useState } from "react";
import { ImagePlus, Video, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { uploadStatusMedia, validateImageFile, validateVideoFile, getVideoDuration, getMediaDimensions } from "@/services/media";
import { createStatus } from "@/services/status";
import { LIMITS } from "@/lib/constants";
import { friendlyError } from "@/lib/errorMap";

export function StatusComposer({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"image" | "video" | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(type: "image" | "video") {
    setErr("");
    fileRef.current?.setAttribute("accept", type === "image" ? "image/*" : "video/*");
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr("");
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    if (isImage) {
      const verr = validateImageFile(f);
      if (verr) return setErr(verr);
    } else {
      const verr = validateVideoFile(f);
      if (verr) return setErr(verr);
      // Duration check (30s cap) BEFORE upload
      const dur = await getVideoDuration(f);
      if (dur > LIMITS.STATUS_VIDEO_MAX_SECONDS) {
        return setErr(`Videos must be ${LIMITS.STATUS_VIDEO_MAX_SECONDS} seconds or shorter.`);
      }
    }
    setKind(isImage ? "image" : "video");
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file || !kind || !profile) return;
    setBusy(true);
    setErr("");
    try {
      const statusId = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const dims = await getMediaDimensions(file);
      const { url, path, contentType } = await uploadStatusMedia({ uid: profile.uid, statusId, file });
      await createStatus({
        owner: profile,
        type: kind,
        mediaURL: url,
        mediaStoragePath: path,
        mediaContentType: contentType,
        text: text.trim() || undefined,
        width: dims.width,
        height: dims.height,
        durationSec: kind === "video" ? await getVideoDuration(file) : undefined,
      });
      toast("Status posted. It disappears in 24 hours.", "success");
      reset();
      onPosted();
      onClose();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setKind(null);
    setPreviewUrl("");
    setText("");
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add status" size="md">
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
      {!file ? (
        <div className="grid grid-cols-2 gap-3 py-2">
          <button onClick={() => pick("image")} className="flex flex-col items-center gap-2 rounded-2xl border border-brand-100 p-6 hover:bg-brand-50">
            <ImagePlus size={28} className="text-brand-600" />
            <span className="text-sm font-medium text-ink">Photo</span>
            <span className="text-xs text-ink-muted">JPEG, PNG, WebP</span>
          </button>
          <button onClick={() => pick("video")} className="flex flex-col items-center gap-2 rounded-2xl border border-brand-100 p-6 hover:bg-brand-50">
            <Video size={28} className="text-brand-600" />
            <span className="text-sm font-medium text-ink">Video</span>
            <span className="text-xs text-ink-muted">Up to {LIMITS.STATUS_VIDEO_MAX_SECONDS}s</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            {kind === "image" ? (
              <img src={previewUrl} alt="preview" className="mx-auto max-h-72 object-contain" />
            ) : (
              <video src={previewUrl} className="mx-auto max-h-72 object-contain" controls />
            )}
            <button onClick={() => { reset(); }} className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white" aria-label="Remove">
              <X size={16} />
            </button>
          </div>
          <Input label="Caption (optional)" value={text} maxLength={150} onChange={(e) => setText(e.target.value)} placeholder="Add a caption…" />
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button fullWidth onClick={submit} loading={busy}>
            Share status
          </Button>
        </div>
      )}
    </Modal>
  );
}
