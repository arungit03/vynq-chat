'use client'

import { useState } from 'react'
import { Check, CheckCheck, CornerUpLeft, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/dates'
import { useAuth } from '@/features/auth/auth-provider'
import { MediaMessage } from '@/components/chat/MediaMessage'
import { REACTION_EMOJIS } from '@/lib/constants'
import type { Message } from '@/types'

export interface MessageBubbleProps {
  message: Message
  onOpenMedia?: (message: Message) => void
  onReply?: (message: Message) => void
  onReact?: (message: Message, emoji: string) => void
  /** True when the peer has read this message (outgoing only). */
  seen?: boolean
}

/** Short, one-line preview used when starting a reply from this message. */
export function replyPreviewFor(message: Message): string {
  if (message.text) return message.text
  return message.type === 'image' ? 'Photo' : 'Video'
}

/**
 * A single message bubble. Mine are right-aligned with a brand background,
 * theirs left-aligned on the raised surface. Media renders inline and taps
 * through to the fullscreen viewer. Bubbles also carry a reply preview,
 * togglable emoji reactions, and (for outgoing) a sent/seen indicator.
 */
export function MessageBubble({ message, onOpenMedia, onReply, onReact, seen }: MessageBubbleProps) {
  const { user } = useAuth()
  const mine = message.senderId === user?.uid
  const isMedia = message.type === 'image' || message.type === 'video'
  const myUid = user?.uid ?? ''
  const [pickerOpen, setPickerOpen] = useState(false)

  const reactions = message.reactions ?? {}
  const reactionEntries = Object.entries(reactions)

  const time = formatTime(message.createdAt)

  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {/* Reply preview above the bubble */}
      {message.replyTo && (
        <div
          className={cn(
            'flex max-w-[82%] items-start gap-1.5 rounded-lg border-l-2 border-brand/70 bg-surface-raised px-2.5 py-1.5',
          )}
        >
          <CornerUpLeft size={13} className="mt-0.5 shrink-0 text-brand" />
          <p className="truncate text-xs text-ink-muted">{message.replyTo.preview}</p>
        </div>
      )}

      <div className={cn('flex items-end gap-1.5', mine ? 'flex-row-reverse' : 'flex-row')}>
        {/* Bubble */}
        <div className="max-w-[78%]">
          {isMedia && message.mediaURL ? (
            <MediaMessage message={message} onOpen={(m) => onOpenMedia?.(m)} />
          ) : (
            <div
              className={cn(
                'rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
                mine
                  ? 'rounded-br-md bg-brand text-white'
                  : 'rounded-bl-md border border-border-subtle bg-surface-elevated text-ink',
              )}
            >
              {message.text ? (
                <p className="whitespace-pre-wrap break-words">{message.text}</p>
              ) : null}
            </div>
          )}
          {/* Time + delivery state (beneath media, inside text bubble) */}
          <p
            className={cn(
              'mt-1 flex items-center gap-1 text-[10px] leading-none',
              mine ? 'justify-end text-white/70' : 'text-ink-muted',
            )}
          >
            <span>{time}</span>
            {mine &&
              (seen ? (
                <CheckCheck size={12} aria-label="Seen" className="text-white" />
              ) : (
                <Check size={12} aria-label="Sent" />
              ))}
          </p>
        </div>

        {/* Reply + reaction triggers on the outer edge */}
        {(onReply || onReact) && (
          <div
            className={cn(
              'flex shrink-0 flex-col items-center gap-0.5 pb-4 text-ink-muted/50',
              mine ? 'order-first' : 'order-last',
            )}
          >
            {onReply && (
              <button
                onClick={() => onReply(message)}
                aria-label="Reply"
                className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-surface-raised hover:text-ink"
              >
                <CornerUpLeft size={14} />
              </button>
            )}
            {onReact && (
              <button
                onClick={() => setPickerOpen((o) => !o)}
                aria-label="Add reaction"
                aria-expanded={pickerOpen}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-surface-raised hover:text-ink',
                  pickerOpen && 'bg-surface-raised text-ink',
                )}
              >
                <Smile size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reaction chips */}
      {reactionEntries.length > 0 && (
        <div className={cn('flex flex-wrap items-center gap-1', mine ? 'justify-end' : 'justify-start')}>
          {reactionEntries.map(([emoji, uid]) => (
            <button
              key={emoji}
              onClick={() => onReact?.(message, emoji)}
              title={uid === myUid ? 'You reacted' : 'Reaction'}
              aria-label={`Remove ${emoji} reaction`}
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs leading-none transition-colors',
                uid === myUid
                  ? 'border-brand/40 bg-brand/10'
                  : 'border-border-subtle bg-surface-raised hover:bg-surface',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {pickerOpen && onReact && (
        <div className="flex items-center gap-0.5 rounded-full border border-border-subtle bg-surface-elevated px-1.5 py-1 shadow-md">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(message, emoji)
                setPickerOpen(false)
              }}
              aria-label={`React with ${emoji}`}
              className="rounded-full p-1 text-lg leading-none transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
