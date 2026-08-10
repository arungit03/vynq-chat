'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/auth-provider'
import { useConversation } from '@/hooks/useConversation'
import { useMessages } from '@/hooks/useMessages'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { usePeerTyping } from '@/hooks/usePeerTyping'
import { markConversationRead } from '@/services/messages'
import { toggleReaction } from '@/services/reactions'
import { useToast } from '@/components/ui/Toast'
import { formatDayLabel, toMillis } from '@/lib/dates'
import { MessageBubble, replyPreviewFor } from '@/components/chat/MessageBubble'
import { MediaViewer } from '@/components/chat/MediaViewer'
import { Composer } from '@/components/chat/Composer'
import type { Message, ReplyRef } from '@/types'

function dateSeparators(messages: Message[]): Array<{ key: string; kind: 'date' | 'message'; message?: Message; label?: string }> {
  const rows: Array<{ key: string; kind: 'date' | 'message'; message?: Message; label?: string }> = []
  let lastDay = ''
  for (const m of messages) {
    const day = formatDayLabel(m.createdAt)
    if (day !== lastDay) {
      rows.push({ key: `d-${day}`, kind: 'date', label: day })
      lastDay = day
    }
    rows.push({ key: m.id, kind: 'message', message: m })
  }
  return rows
}

/**
 * Full chat screen: header (peer info + typing state), scrollable message
 * list with date separators, and the composer. Handles replies, reactions and
 * the outgoing sent/seen indicator; marks the conversation read on load.
 */
export function ChatScreen({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const toast = useToast()
  const { user } = useAuth()
  const myUid = user?.uid ?? ''
  const { conversation } = useConversation(conversationId)
  const { messages, loading, loadingOlder, hasMore, loadOlder } = useMessages(conversationId)
  const otherUid = conversation?.members.find((m) => m !== myUid) ?? ''
  const { profile } = usePublicProfile(otherUid)
  const peerTyping = usePeerTyping(conversationId, otherUid || null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [viewerMessage, setViewerMessage] = useState<Message | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null)

  const openMedia = useCallback((m: Message) => setViewerMessage(m), [])

  const openReply = useCallback((m: Message) => {
    setReplyTo({
      messageId: m.id,
      senderId: m.senderId,
      type: m.type,
      preview: replyPreviewFor(m),
    })
  }, [])

  const react = useCallback(
    (m: Message, emoji: string) => {
      if (!myUid) return
      toggleReaction(conversationId, m.id, myUid, emoji, m.reactions).catch(() => {
        toast.error('Could not save reaction — try again.')
      })
    },
    [conversationId, myUid, toast],
  )

  // Auto-scroll to bottom on new messages (only when the user is near bottom).
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  // Mark as read whenever a conversation loads.
  useEffect(() => {
    if (!conversationId || !myUid) return
    markConversationRead(conversationId, myUid).catch(() => undefined)
  }, [conversationId, myUid])

  // Sent/seen: an outgoing message is "seen" once the peer's lastRead passes
  // its createdAt. Read-receipt preferences are enforced in P11 (settings).
  const peerLastRead = conversation?.lastRead?.[otherUid]
  const seenFor = useCallback(
    (m: Message): boolean => {
      if (m.senderId !== myUid || !peerLastRead) return false
      return toMillis(peerLastRead) >= toMillis(m.createdAt)
    },
    [myUid, peerLastRead],
  )

  const rows = dateSeparators(messages)

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
        <Avatar
          src={profile?.avatarURL ?? null}
          name={profile?.displayName ?? profile?.username}
          size={38}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {profile?.displayName ?? profile?.username ?? '…'}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {peerTyping ? (
              <span className="font-medium text-brand">typing…</span>
            ) : profile?.username ? (
              `@${profile.username}`
            ) : (
              '…'
            )}
          </p>
        </div>
        <button
          aria-label="Conversation info"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <Info size={20} />
        </button>
      </header>

      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current
          if (!el) return
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
      >
        {hasMore && (
          <div className="flex justify-center pb-3">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full bg-surface-raised px-4 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load older'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-ink">You’re connected!</p>
            <p className="max-w-xs text-xs text-ink-muted">
              Messages disappear 7 days after they’re sent. Say hi 👋
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map((row) =>
              row.kind === 'date' ? (
                <div key={row.key} className="flex justify-center py-2">
                  <span className="rounded-full bg-surface-raised px-3 py-1 text-[11px] font-medium text-ink-muted">
                    {row.label}
                  </span>
                </div>
              ) : (
                <MessageBubble
                  key={row.key}
                  message={row.message!}
                  onOpenMedia={openMedia}
                  onReply={openReply}
                  onReact={react}
                  seen={seenFor(row.message!)}
                />
              ),
            )}
          </div>
        )}
      </div>

      <Composer
        conversationId={conversationId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      <MediaViewer message={viewerMessage} onClose={() => setViewerMessage(null)} />
    </div>
  )
}
