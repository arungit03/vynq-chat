import { AlertCircle, Check, CheckCheck, Loader2 } from "lucide-react";
import { formatChatTime } from "@/lib/time";
import type { Message } from "@/lib/firebase/types";

interface ChatBubbleProps {
  message: Message;
  mine: boolean;
  readReceiptsEnabled: boolean;
  onImageClick?: (url: string) => void;
  onRetry?: () => void;
}

export function ChatBubble({ message, mine, readReceiptsEnabled, onImageClick, onRetry }: ChatBubbleProps) {
  const isMedia = message.type === "image" || message.type === "video";
  const expired = Date.now() > message.expiresAt;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} animate-message-in`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 ${
          mine
            ? "rounded-br-md bg-brand-600 text-white"
            : "rounded-bl-md bg-white text-ink shadow-soft"
        }`}
      >
        {isMedia && message.mediaURL && (
          <div className="mb-1 overflow-hidden rounded-xl">
            {message.type === "image" ? (
              <button onClick={() => onImageClick?.(message.mediaURL!)} className="block">
                <img
                  src={message.mediaURL}
                  alt="Shared image"
                  className="max-h-72 w-full object-cover"
                  loading="lazy"
                />
              </button>
            ) : (
              <video
                src={message.mediaURL}
                controls
                className="max-h-72 w-full rounded-xl bg-black"
                preload="metadata"
              />
            )}
          </div>
        )}

        {message.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{message.text}</p>}

        <div className={`mt-1 flex items-center justify-end gap-1 ${mine ? "text-brand-100" : "text-ink-muted"}`}>
          <span className="text-[11px]">{formatChatTime(message.createdAt)}</span>
          {mine && readReceiptsEnabled && (
            <span
              aria-label={
                message.status === "failed"
                  ? "Failed to send"
                  : message.status === "sending"
                    ? "Sending"
                    : message.status === "read"
                      ? "Read"
                      : message.status === "delivered"
                        ? "Delivered"
                        : "Sent"
              }
            >
              {message.status === "failed" ? (
                <AlertCircle size={14} className="text-danger" />
              ) : message.status === "sending" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : message.status === "read" ? (
                <CheckCheck size={14} className="text-brand-100" />
              ) : message.status === "delivered" ? (
                <CheckCheck size={14} className="text-brand-100/70" />
              ) : (
                <Check size={14} />
              )}
            </span>
          )}
          {mine && message.status === "failed" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 text-[11px] font-semibold underline underline-offset-2 hover:text-white"
            >
              Retry
            </button>
          )}
        </div>
        {expired && (
          <p className="mt-0.5 text-[10px] italic opacity-70">expires {formatExpiryIn(message.expiresAt)}</p>
        )}
      </div>
    </div>
  );
}

function formatExpiryIn(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  const hrs = Math.max(0, Math.floor(diff / 3_600_000));
  if (hrs >= 24) return `in ${Math.floor(hrs / 24)}d`;
  if (hrs >= 1) return `in ${hrs}h`;
  return "soon";
}
