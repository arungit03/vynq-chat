'use client'

import Link from 'next/link'
import { MessageSquarePlus, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConversationSkeleton } from '@/components/ui/Skeleton'
import { ConversationListItem } from '@/components/conversations/ConversationListItem'
import { useConversations } from '@/hooks/useConversations'

/**
 * Home — the private messaging screen. Live conversation list ordered by
 * most recent activity; new chats start from Search (request → accept → DM).
 */
export default function HomePage() {
  const { conversations, ready } = useConversations()

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle bg-surface-elevated px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Chats</h1>
        <Link
          href="/search"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          aria-label="New chat"
        >
          <MessageSquarePlus size={20} />
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!ready ? (
          <ConversationSkeleton />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<Search size={28} />}
            title="Find someone to start chatting"
            description="Search a username, send a request, and once it’s accepted you can message them."
            action={
              <Link
                href="/search"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                Search people
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <ConversationListItem key={c.id} conversation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
