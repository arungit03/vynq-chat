'use client'

import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/dates'
import { useAuth } from '@/features/auth/auth-provider'
import type { Message } from '@/types'

/**
 * A single message bubble. Mine are right-aligned with a brand background,
 * theirs left-aligned on the raised surface. Media types render inline.
 */
export function MessageBubble({ message }: { message: Message }) {
  const { user } = useAuth()
  const mine = message.senderId === user?.uid

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
        {message.type === 'text' || message.caption ? (
          <p className="whitespace-pre-wrap break-words">{message.text ?? message.caption}</p>
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
