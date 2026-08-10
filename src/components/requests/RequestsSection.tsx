'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Inbox, UserPlus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { usePendingRequests } from '@/hooks/usePendingRequests'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { useAuth } from '@/features/auth/auth-provider'
import { acceptFriendRequest, cancelFriendRequest, rejectFriendRequest } from '@/services/connections'
import { useToast } from '@/components/ui/Toast'
import { mapFunctionError } from '@/lib/callable'
import type { FriendRequest } from '@/types'

/** A pending request row with accept/reject (incoming) or cancel (outgoing). */
function RequestRow({ request }: { request: FriendRequest }) {
  const router = useRouter()
  const toast = useToast()
  const { user } = useAuth()
  const myUid = user?.uid ?? ''
  const incoming = request.receiverId === myUid
  const otherUid = incoming ? request.senderId : request.receiverId
  const { profile } = usePublicProfile(otherUid)
  const [busy, setBusy] = useState<'accept' | 'reject' | 'cancel' | null>(null)

  async function run(action: 'accept' | 'reject' | 'cancel') {
    setBusy(action)
    try {
      if (action === 'accept') {
        const { conversationId } = await acceptFriendRequest(request.id)
        toast.success('Request accepted')
        router.push(`/chat/${conversationId}`)
      } else if (action === 'reject') {
        await rejectFriendRequest(request.id)
        toast.info('Request declined')
      } else {
        await cancelFriendRequest(request.id)
        toast.info('Request cancelled')
      }
    } catch (err) {
      toast.error(mapFunctionError(err, 'Something went wrong'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar
        src={profile?.avatarURL ?? null}
        name={profile?.displayName ?? profile?.username}
        size={44}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {profile?.displayName ?? profile?.username ?? '…'}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {incoming ? 'Wants to connect with you' : `Requested · @${profile?.username ?? '…'}`}
        </p>
      </div>

      {incoming ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => run('accept')}
            loading={busy === 'accept'}
            leftIcon={busy !== 'accept' ? <Check size={14} /> : undefined}
          >
            Accept
          </Button>
          <Button size="sm" variant="secondary" onClick={() => run('reject')} loading={busy === 'reject'}>
            Decline
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => run('cancel')} loading={busy === 'cancel'}>
          Cancel
        </Button>
      )}
    </div>
  )
}

/** All pending requests, grouped incoming first, then outgoing. */
export function RequestsSection() {
  const { incoming, outgoing } = usePendingRequests()

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={28} />}
        title="No requests yet"
        description="Requests from people who want to connect will show up here."
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-4">
        <UserPlus size={16} className="text-brand" />
        <h2 className="text-sm font-semibold text-ink">Requests</h2>
        <span className="ml-auto text-xs text-ink-muted">{incoming.length} incoming</span>
      </div>
      {incoming.length > 0 && (
        <div className="mt-2 border-b border-border-subtle pb-1">
          {incoming.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <div className="mt-2">
          <p className="px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Sent
          </p>
          {outgoing.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  )
}
