import { useRef, useState, type ChangeEvent } from "react";
import { Paperclip, Send, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { validateImageFile, validateVideoFile } from "@/services/media";
import { LIMITS } from "@/lib/constants";
import { friendlyError } from "@/lib/errorMap";
import { useToast } from "@/components/ui/Toast";

export interface PendingMedia {
  file: File;
  kind: "image" | "video";
  previewUrl: string;
}

interface MessageComposerProps {
  onSendText: (text: string) => Promise<void>;
  onSendMedia: (media: PendingMedia) => Promise<void>;
  disabled?: boolean;
  uploading?: boolean;
}

const EMOJIS = ["😊", "😂", "❤️", "👍", "🎉", "🔥", "😍", "🙌", "😎", "🤔", "😢", "✨"];

export function MessageComposer({ onSendText, onSendMedia, disabled, uploading }: MessageComposerProps) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingMedia | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const err = isImage ? validateImageFile(file) : validateVideoFile(file);
    if (err) {
      toast(err, "error");
      return;
    }
    setPending({
      file,
      kind: isImage ? "image" : "video",
      previewUrl: URL.createObjectURL(file),
    });
    e.target.value = "";
  }

  function addEmoji(em: string) {
    setText((t) => t + em);
  }

  async function submitText() {
    if (sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > LIMITS.MESSAGE_TEXT_MAX) {
      toast(`Messages are limited to ${LIMITS.MESSAGE_TEXT_MAX} characters.`, "error");
      return;
    }
    setSending(true);
    try {
      await onSendText(trimmed);
      setText("");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSending(false);
    }
  }

  async function submitMedia() {
    if (!pending) return;
    try {
      await onSendMedia(pending);
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  }

  const hasContent = text.trim().length > 0 || !!pending;

  return (
    <div className="safe-bottom border-t border-brand-100 bg-white/95 px-3 py-2 backdrop-blur">
      {pending && (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-brand-50 p-2">
          {pending.kind === "image" ? (
            <img src={pending.previewUrl} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <video src={pending.previewUrl} className="h-12 w-12 rounded-lg bg-black object-cover" />
          )}
          <span className="flex-1 text-sm text-brand-700">
            {uploading ? "Uploading…" : `Ready to send ${pending.kind}`}
          </span>
          {!uploading && (
            <button
              onClick={() => {
                URL.revokeObjectURL(pending.previewUrl);
                setPending(null);
              }}
              className="rounded-full p-1 text-ink-muted hover:bg-white"
              aria-label="Remove attachment"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {showEmoji && (
        <div className="mb-2 grid grid-cols-6 gap-1 rounded-xl bg-brand-50 p-2">
          {EMOJIS.map((em) => (
            <button
              key={em}
              onClick={() => addEmoji(em)}
              className="rounded-lg p-1.5 text-xl hover:bg-white"
              aria-label={`Add emoji ${em}`}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading || sending}
          className="rounded-full p-2.5 text-ink-soft hover:bg-brand-50 disabled:opacity-50"
          aria-label="Attach image or video"
        >
          <Paperclip size={20} />
        </button>
        <button
          onClick={() => setShowEmoji((s) => !s)}
          disabled={disabled || sending}
          className={`rounded-full p-2.5 hover:bg-brand-50 ${showEmoji ? "text-brand-600" : "text-ink-soft"}`}
          aria-label="Emoji"
        >
          <Smile size={20} />
        </button>

        <div className="flex-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitText();
              }
            }}
            placeholder={disabled ? "Connecting…" : "Message"}
            aria-label="Message"
            className="!py-2.5"
          />
        </div>

        <Button
          onClick={pending ? submitMedia : submitText}
          loading={uploading || sending}
          disabled={disabled || !hasContent || uploading || sending}
          className="!px-3.5 !py-3"
          aria-label={pending ? "Send media" : "Send message"}
        >
          {pending ? <Send size={18} /> : <Send size={18} />}
        </Button>
      </div>
    </div>
  );
}
