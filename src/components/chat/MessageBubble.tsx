'use client'

import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/dates'
import { useAuth } from '@/features/auth/auth-provider'
import { MediaMessage } from '@/components/chat/MediaMessage'
import type { Message } from '@/types'

export interface MessageBubbleProps {
  message: Message
  onOpenMedia?: (message: Message) => void
}

/**
 * A single message bubble. Mine are right-aligned with a brand background,
 * theirs left-aligned on the raised surface. Media types render inline and
 * tap through to the fullscreen viewer.
 */
export function MessageBubble({ message, onOpenMedia }: MessageBubbleProps) {
  const { user } = useAuth()
  const mine = message.senderId === user?.uid
  const isMedia = message.type === 'image' || message.type === 'video'

  if (isMedia && message.mediaURL) {
    return (
      <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
        <div className={cn('flex max-w-[82%] flex-col', mine ? 'items-end' : 'items-start')}>
          <MediaMessage message={message} onOpen={(m) => onOpenMedia?.(m)} />
          <p className={cn('mt-1 px-1 text-[10px] leading-none', mine ? 'text-ink-muted' : 'text-ink-muted')}>
            {formatTime(message.createdAt)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
          mine
            ? 'rounded-br-md bg-brand text-white'
            : 'rounded-bl-md border border-border-subtle bg-surface-elevated text-ink',
        )}
      >
        {message.text ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : null}
        <p
          className={cn(
            'mt-1 text-right text-[10px] leading-none',
            mine ? 'text-white/70' : 'text-ink-muted',
          )}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}
