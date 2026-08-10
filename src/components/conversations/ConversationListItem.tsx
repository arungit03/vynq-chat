'use client'

import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/auth-provider'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { toMillis, formatRelativeShort } from '@/lib/dates'
import type { Conversation, MessageType } from '@/types'

function previewLabel(type: MessageType, preview: string): string {
  if (type === 'image') return '📷 Photo'
  if (type === 'video') return '🎬 Video'
  return preview
}

/** A single row in the home conversation list. */
export function ConversationListItem({ conversation }: { conversation: Conversation }) {
  const { user } = useAuth()
  const myUid = user?.uid ?? ''
  const otherUid = conversation.members.find((m) => m !== myUid) ?? ''
  const { profile } = usePublicProfile(otherUid)

  const ephem = conversation.ephemeralLastMessage
  const isMine = ephem?.senderId === myUid
  const lastRead = conversation.lastRead?.[myUid]
  const unread =
    !!ephem && ephem.senderId !== myUid && toMillis(lastRead) < toMillis(ephem.createdAt)

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-raised"
    >
      <Avatar
        src={profile?.avatarURL ?? null}
        name={profile?.displayName ?? profile?.username}
        size={50}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink">
            {profile?.displayName ?? profile?.username ?? '…'}
          </p>
          {ephem && (
            <span className="shrink-0 text-[11px] text-ink-muted">
              {formatRelativeShort(ephem.createdAt)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {ephem ? (
            <p
              className={`truncate text-sm ${
                unread ? 'font-semibold text-ink' : 'text-ink-muted'
              }`}
            >
              {isMine ? 'You: ' : ''}
              {previewLabel(ephem.type, ephem.preview)}
            </p>
          ) : (
            <p className="truncate text-sm text-ink-muted">Say hi 👋</p>
          )}
        </div>
      </div>

      {unread && (
        <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
          •
        </span>
      )}
    </Link>
  )
}
