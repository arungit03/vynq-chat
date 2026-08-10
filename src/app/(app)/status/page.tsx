'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/auth-provider'
import { useConnections } from '@/hooks/useConnections'
import { useBlockedUids } from '@/hooks/useBlockedUids'
import { useStatuses } from '@/hooks/useStatuses'
import { useViewedStatuses } from '@/hooks/useViewedStatuses'
import { usePublicProfiles } from '@/hooks/usePublicProfiles'
import { StatusViewer } from '@/components/status/StatusViewer'
import { formatRelativeShort } from '@/lib/dates'
import type { Status } from '@/types'

/** Status ring state for one owner. */
function ringFor(
  ownerId: string,
  statuses: Status[],
  viewed: Record<string, boolean>,
  myUid: string,
): 'unseen' | 'seen' | 'none' {
  if (statuses.length === 0) return 'none'
  if (ownerId === myUid) return 'seen'
  const unseen = statuses.some((s) => viewed[s.id] === false)
  return unseen ? 'unseen' : 'seen'
}

/**
 * Status — Instagram-style. My status plus my connections' recent updates.
 * Tapping a row opens the fullscreen viewer (30-second rule), which records
 * views so rings update live.
 */
export default function StatusPage() {
  const router = useRouter()
  const { user } = useAuth()
  const myUid = user?.uid ?? ''
  const { connections, ready: connectionsReady } = useConnections()
  const { blocked } = useBlockedUids()
  // Skip blocked users so the statuses query can't fail on an unreadable doc.
  const visibleConnections = useMemo(
    () => connections.filter((c) => !blocked.has(c)),
    [connections, blocked],
  )
  // `in` queries cap at 10 owners (me + up to 9 connections).
  const ownerIds = useMemo(
    () => [myUid, ...visibleConnections].slice(0, 10),
    [myUid, visibleConnections],
  )
  const { statuses, ready: statusesReady } = useStatuses(ownerIds)
  const { profiles } = usePublicProfiles(ownerIds)
  const { viewed } = useViewedStatuses(statuses)
  const [viewerStart, setViewerStart] = useState<number | null>(null)

  const byOwner = useMemo(() => {
    const map = new Map<string, Status[]>()
    for (const s of statuses) {
      const list = map.get(s.ownerId) ?? []
      list.push(s)
      map.set(s.ownerId, list)
    }
    return map
  }, [statuses])

  // Me first, then connections that currently have statuses.
  const ownerOrder = useMemo(
    () => [myUid, ...visibleConnections].filter((uid) => (byOwner.get(uid)?.length ?? 0) > 0),
    [myUid, visibleConnections, byOwner],
  )

  const orderedStatuses = useMemo(
    () => ownerOrder.flatMap((uid) => byOwner.get(uid) ?? []),
    [ownerOrder, byOwner],
  )

  const myStatuses = byOwner.get(myUid) ?? []
  const myProfile = profiles[myUid]

  function openOwner(ownerId: string) {
    const first = orderedStatuses.findIndex((s) => s.ownerId === ownerId)
    if (first >= 0) setViewerStart(first)
  }

  const loading = !connectionsReady || !statusesReady

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border-subtle bg-surface-elevated px-3 py-2.5">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-ink">Status</h1>
        <button
          onClick={() => router.push('/status/create')}
          aria-label="Create status"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <Camera size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Skeleton className="h-13 w-13 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : ownerOrder.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-ink">No statuses yet</p>
            <p className="max-w-xs text-xs text-ink-muted">
              Share a photo or short video — it disappears after 24 hours.
            </p>
            <button
              onClick={() => router.push('/status/create')}
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              <Plus size={16} /> Add to your status
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* My status */}
            <button
              onClick={() => openOwner(myUid)}
              className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-surface-raised"
            >
              <Avatar
                src={myProfile?.avatarURL ?? null}
                name={myProfile?.displayName ?? myProfile?.username ?? 'Me'}
                size={52}
                ring={myStatuses.length > 0 ? 'seen' : 'none'}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">My status</p>
                <p className="truncate text-xs text-ink-muted">
                  {myStatuses.length > 0
                    ? `Added ${formatRelativeShort(myStatuses[0].createdAt)}`
                    : 'Tap to add a photo or video'}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  router.push('/status/create')
                }}
                aria-label="Add to your status"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-strong"
              >
                <Plus size={20} />
              </button>
            </button>

            {/* Connections with updates */}
            <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Recent updates
            </p>
            {ownerOrder
              .filter((uid) => uid !== myUid)
              .map((uid) => {
                const list = byOwner.get(uid) ?? []
                const latest = list[0]
                const profile = profiles[uid]
                const ring = ringFor(uid, list, viewed, myUid)
                return (
                  <button
                    key={uid}
                    onClick={() => openOwner(uid)}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                  >
                    <Avatar
                      src={profile?.avatarURL ?? null}
                      name={profile?.displayName ?? profile?.username}
                      size={52}
                      ring={ring}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {profile?.displayName ?? profile?.username ?? '…'}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {profile?.username ? `@${profile.username}` : '…'}
                      </p>
                    </div>
                    {latest ? (
                      <span className="shrink-0 text-xs text-ink-muted">
                        {formatRelativeShort(latest.createdAt)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
          </div>
        )}
      </div>

      {viewerStart !== null && orderedStatuses.length > 0 && (
        <StatusViewer
          statuses={orderedStatuses}
          startIndex={viewerStart}
          profileOf={(ownerId) => profiles[ownerId]}
          onClose={() => setViewerStart(null)}
        />
      )}
    </div>
  )
}
