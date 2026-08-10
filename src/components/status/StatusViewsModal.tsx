'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { listStatusViews } from '@/services/statuses'
import { formatRelativeShort } from '@/lib/dates'
import type { StatusView } from '@/types'

export interface StatusViewsModalProps {
  statusId: string
  onClose: () => void
}

function ViewerRow({ view }: { view: StatusView }) {
  const { profile } = usePublicProfile(view.viewerId)
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Avatar
        src={profile?.avatarURL ?? null}
        name={profile?.displayName ?? profile?.username}
        size={38}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {profile?.displayName ?? profile?.username ?? '…'}
        </p>
        {profile?.username ? (
          <p className="truncate text-xs text-ink-muted">@{profile.username}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-ink-muted">{formatRelativeShort(view.viewedAt)}</span>
    </li>
  )
}

/** Who viewed a status, newest first. */
export function StatusViewsModal({ statusId, onClose }: StatusViewsModalProps) {
  const [views, setViews] = useState<StatusView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listStatusViews(statusId)
      .then((result) => {
        if (!cancelled) {
          setViews(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [statusId])

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Status viewers"
        className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-elevated sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            Viewed by {views.length > 0 ? views.length : ''}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close viewers"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-40 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : views.length === 0 ? (
            <p className="flex h-40 items-center justify-center text-sm text-ink-muted">
              No one has viewed this yet.
            </p>
          ) : (
            <ul>
              {views.map((view) => (
                <ViewerRow key={view.viewerId} view={view} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
