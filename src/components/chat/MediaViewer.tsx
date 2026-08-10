'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { formatTime } from '@/lib/dates'
import type { Message } from '@/types'

export interface MediaViewerProps {
  message: Message | null
  onClose: () => void
}

/**
 * Fullscreen media lightbox. Native dialog with a dark backdrop; ESC and
 * backdrop click close. Video is playable inline.
 */
export function MediaViewer({ message, onClose }: MediaViewerProps) {
  const { user } = useAuth()
  const mine = message?.senderId === user?.uid

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!message || !message.mediaURL) return null
  const isVideo = message.type === 'video'

  return (
    <div
      className="fixed inset-0 z-100 flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'Video viewer' : 'Photo viewer'}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm">
          {mine ? 'You' : 'Message'}
          {' · '}
          {formatTime(message.createdAt)}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X size={20} />
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={message.mediaURL}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.mediaURL}
            alt={message.caption ?? 'Photo'}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        )}
      </div>

      {message.caption && (
        <div className="px-6 pb-6 text-center text-sm text-white/90" onClick={(e) => e.stopPropagation()}>
          {message.caption}
        </div>
      )}
    </div>
  )
}
