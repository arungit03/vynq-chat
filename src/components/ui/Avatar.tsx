'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type StatusRing = 'unseen' | 'seen' | 'none'

export interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  ring?: StatusRing
  className?: string
}

function initialsOf(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const RING_CLASSES: Record<StatusRing, string> = {
  unseen: 'bg-gradient-to-tr from-brand via-emerald-400 to-teal-300',
  seen: 'border border-ink-muted/30',
  none: 'bg-transparent',
}

export function Avatar({ src, name, size = 40, ring = 'none', className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = !!src && !failed
  const dimension = { width: size, height: size }

  const inner = (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised font-semibold text-ink-muted"
      style={{ ...dimension, fontSize: Math.max(size * 0.36, 10) }}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <span>{initialsOf(name)}</span>
      )}
    </span>
  )

  if (ring === 'none') {
    return <span className={cn('inline-flex', className)}>{inner}</span>
  }

  return (
    <span
      className={cn('inline-flex rounded-full p-[2.5px]', RING_CLASSES[ring], className)}
      title={ring === 'unseen' ? 'New status available' : undefined}
    >
      {inner}
    </span>
  )
}
