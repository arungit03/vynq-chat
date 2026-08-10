'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { markStatusViewed } from '@/services/statuses'
import { StatusViewsModal } from '@/components/status/StatusViewsModal'
import { formatTime } from '@/lib/dates'
import { STATUS_IMAGE_DURATION_MS, MAX_STATUS_VIDEO_DURATION_S } from '@/lib/constants'
import type { PublicProfile, Status } from '@/types'

export interface StatusViewerProps {
  /** Flattened, ordered statuses to play through (one or many owners). */
  statuses: Status[]
  startIndex: number
  profileOf: (ownerId: string) => PublicProfile | undefined
  onClose: () => void
}

/** How long a single status stays up before advancing. */
function durationFor(status: Status): number {
  if (status.type === 'image' || !status.mediaDuration) return STATUS_IMAGE_DURATION_MS
  return Math.min(status.mediaDuration * 1000, MAX_STATUS_VIDEO_DURATION_S * 1000)
}

/**
 * Fullscreen status viewer. Images stay for STATUS_IMAGE_DURATION_MS, videos
 * play up to the 30-second rule, then auto-advance. Hold to pause, tap left /
 * right to navigate; each shown status is recorded as viewed.
 */
export function StatusViewer({ statuses, startIndex, profileOf, onClose }: StatusViewerProps) {
  const { user } = useAuth()
  const myUid = user?.uid ?? ''
  const [index, setIndex] = useState(startIndex)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const elapsedRef = useRef(0)
  const downRef = useRef<{ x: number; time: number } | null>(null)

  const status = statuses[index]
  const duration = useMemo(() => (status ? durationFor(status) : STATUS_IMAGE_DURATION_MS), [status])
  const owner = status ? profileOf(status.ownerId) : undefined

  // Record the view whenever a new status is shown.
  useEffect(() => {
    if (!status || !myUid) return
    markStatusViewed(status.id, myUid).catch(() => undefined)
  }, [status, myUid])

  // Auto-advance timer (hold/pause stops it; the elapsed counter is preserved).
  useEffect(() => {
    if (paused || !status) return
    const start = Date.now()
    const base = elapsedRef.current
    const iv = window.setInterval(() => {
      const total = base + (Date.now() - start)
      elapsedRef.current = total
      setElapsed(total)
      if (total >= duration) {
        elapsedRef.current = 0
        setElapsed(0)
        if (index < statuses.length - 1) setIndex(index + 1)
        else onClose()
      }
    }, 100)
    return () => window.clearInterval(iv)
  }, [index, paused, duration, statuses.length, onClose, status])

  const goPrev = useCallback(() => {
    if (index <= 0) return
    elapsedRef.current = 0
    setElapsed(0)
    setIndex(index - 1)
  }, [index])

  const goNext = useCallback(() => {
    if (index >= statuses.length - 1) {
      onClose()
      return
    }
    elapsedRef.current = 0
    setElapsed(0)
    setIndex(index + 1)
  }, [index, statuses.length, onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  if (!status) return null

  const progress = Math.min(elapsed / duration, 1)

  return (
    <div
      className="fixed inset-0 z-50 select-none bg-black"
      onPointerDown={(e) => {
        downRef.current = { x: e.clientX, time: Date.now() }
        setPaused(true)
      }}
      onPointerUp={(e) => {
        const down = downRef.current
        downRef.current = null
        setPaused(false)
        if (down && Date.now() - down.time < 250) {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          if (x < rect.width * 0.3) goPrev()
          else goNext()
        }
      }}
    >
      {/* Progress bars */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2 pt-3">
        {statuses.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
              style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute inset-x-0 top-3 z-10 flex items-center gap-2 px-3 pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-white">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/20" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {owner?.displayName ?? owner?.username ?? '…'}
            </p>
            <p className="text-xs text-white/60">{formatTime(status.createdAt)}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setViewsOpen(true)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Who saw this status"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15"
        >
          <Eye size={19} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Close status"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15"
        >
          <X size={20} />
        </button>
      </div>

      {/* Media */}
      <div className="flex h-full w-full items-center justify-center">
        {status.type === 'video' && status.mediaURL ? (
          <video
            src={status.mediaURL}
            className="max-h-full max-w-full object-contain"
            autoPlay
            muted
            playsInline
            loop
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={status.mediaURL} alt="" className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {/* Caption */}
      {status.caption ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 px-6">
          <p className="mx-auto max-w-md text-center text-sm text-white/90">{status.caption}</p>
        </div>
      ) : null}

      {/* Hint */}
      {paused && (
        <div className="pointer-events-none absolute bottom-24 z-10 flex w-full justify-center">
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/80">Holding…</span>
        </div>
      )}

      {viewsOpen && (
        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <StatusViewsModal statusId={status.id} onClose={() => setViewsOpen(false)} />
        </div>
      )}
    </div>
  )
}
