'use client'

import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

export interface MediaMessageProps {
  message: Message
  onOpen: (message: Message) => void
}

/**
 * Inline image/video bubble. Aspect-aware sizing via CSS max constraints;
 * tapping opens the fullscreen viewer.
 */
export function MediaMessage({ message, onOpen }: MediaMessageProps) {
  const isVideo = message.type === 'video'
  const ratio =
    message.mediaWidth && message.mediaHeight ? message.mediaWidth / message.mediaHeight : undefined

  return (
    <button
      type="button"
      onClick={() => onOpen(message)}
      className="relative block max-w-[78%] overflow-hidden rounded-2xl bg-surface-raised text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label={isVideo ? 'Open video' : 'Open image'}
    >
      <div
        className="relative overflow-hidden"
        style={
          ratio
            ? { aspectRatio: `${message.mediaWidth} / ${message.mediaHeight}` }
            : undefined
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.mediaURL ?? ''}
          alt={message.caption ?? (isVideo ? 'Video' : 'Photo')}
          className="max-h-80 w-full object-cover"
          draggable={false}
        />
        {isVideo && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
              <Play size={20} className="ml-0.5" />
            </span>
          </span>
        )}
      </div>
      {message.caption && (
        <p
          className={cn(
            'px-3 py-2 text-sm',
            message.type === 'image' || message.type === 'video' ? 'text-ink' : '',
          )}
        >
          {message.caption}
        </p>
      )}
    </button>
  )
}
