'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, MessageCircle, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/auth-provider'
import { useRelationshipState } from '@/hooks/useRelationshipState'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { acceptFriendRequest, rejectFriendRequest, sendFriendRequest } from '@/services/connections'
import { useToast } from '@/components/ui/Toast'
import { mapFunctionError } from '@/lib/callable'

/**
 * One search result row. Shows the profile and a context-aware action
 * (Add / Pending / Accept / Chat) driven by the live relationship state.
 */
export function SearchResultRow({ uid, incomingRequestId }: { uid: string; incomingRequestId?: string }) {
  const router = useRouter()
  const toast = useToast()
  const { user } = useAuth()
  const { profile } = usePublicProfile(uid)
  const relationship = useRelationshipState(uid)
  const [busy, setBusy] = useState(false)

  const myUid = user?.uid ?? ''
  const conversationId = [myUid, uid].sort().join('_')

  async function onAdd() {
    setBusy(true)
    try {
      await sendFriendRequest(uid)
      toast.success('Request sent')
    } catch (err) {
      toast.error(mapFunctionError(err, 'Could not send request'))
    } finally {
      setBusy(false)
    }
  }

  async function onAccept() {
    if (!incomingRequestId) return
    setBusy(true)
    try {
      const { conversationId } = await acceptFriendRequest(incomingRequestId)
      router.push(`/chat/${conversationId}`)
    } catch (err) {
      toast.error(mapFunctionError(err, 'Could not accept request'))
    } finally {
      setBusy(false)
    }
  }

  async function onReject() {
    if (!incomingRequestId) return
    setBusy(true)
    try {
      await rejectFriendRequest(incomingRequestId)
      toast.info('Request declined')
    } catch (err) {
      toast.error(mapFunctionError(err, 'Could not decline request'))
    } finally {
      setBusy(false)
    }
  }

  const actionByState = () => {
    if (busy) return <Loader2 size={18} className="animate-spin text-ink-muted" aria-hidden />
    switch (relationship) {
      case 'none':
        return (
          <button
            onClick={onAdd}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-soft px-3 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
          >
            <UserPlus size={14} /> Add
          </button>
        )
      case 'outgoing_pending':
        return (
          <span className="flex h-8 items-center rounded-lg bg-surface-raised px-3 text-xs font-medium text-ink-muted">
            Pending
          </span>
        )
      case 'incoming_pending':
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAccept}
              aria-label="Accept request"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              <Check size={14} /> Accept
            </button>
            <button
              onClick={onReject}
              aria-label="Decline request"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        )
      case 'connected':
        return (
          <button
            onClick={() => router.push(`/chat/${conversationId}`)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-raised px-3 text-xs font-semibold text-ink transition-colors hover:bg-border-subtle/70"
          >
            <MessageCircle size={14} /> Message
          </button>
        )
      case 'blocked':
        return <span className="text-xs text-ink-muted">Blocked</span>
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar src={profile?.avatarURL ?? null} name={profile?.displayName ?? profile?.username} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{profile?.displayName ?? profile?.username ?? '…'}</p>
        <p className="truncate text-xs text-ink-muted">@{profile?.username ?? '…'}</p>
      </div>
      {actionByState()}
    </div>
  )
}
