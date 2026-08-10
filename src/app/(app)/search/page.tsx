'use client'

import { useEffect, useState } from 'react'
import { Inbox, Search as SearchIcon, UserSearch } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/auth-provider'
import { searchUsers } from '@/services/search'
import { SearchResultRow } from '@/components/search/SearchResultRow'
import { RequestsSection } from '@/components/requests/RequestsSection'
import { usePendingRequests } from '@/hooks/usePendingRequests'
import { cn } from '@/lib/utils'
import type { PublicProfile } from '@/types'

/**
 * Search + connections. Type a username to find people; a "Requests" tab
 * shows incoming/outgoing requests with a live badge.
 */
export default function SearchPage() {
  const { user } = useAuth()
  const myUid = user?.uid ?? ''
  const { incoming } = usePendingRequests()

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [resultsFor, setResultsFor] = useState<string | null>(null)
  const [results, setResults] = useState<PublicProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [tab, setTab] = useState<'search' | 'requests'>('search')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [query])

  // Reset the result cache whenever the query clears or changes (render-time
  // adjustment — never mutate state synchronously inside the effect).
  if (resultsFor !== debounced) {
    setResultsFor(debounced)
    setResults([])
    setSearching(debounced !== '')
  }

  useEffect(() => {
    if (!debounced) return
    let cancelled = false
    searchUsers(debounced, myUid)
      .then((r) => {
        if (!cancelled) setResults(r)
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, myUid])

  const requestBadge = incoming.length

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border-subtle bg-surface-elevated px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Search</h1>
        <div className="mt-3 flex items-center gap-1.5">
          {(['search', 'requests'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                tab === t ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
              )}
            >
              {t === 'search' ? <UserSearch size={15} /> : <Inbox size={15} />}
              {t === 'search' ? 'Find people' : 'Requests'}
              {t === 'requests' && requestBadge > 0 && (
                <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                  {requestBadge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {tab === 'search' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-4 pt-3">
            <Input
              placeholder="Search by username…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              leftIcon={<SearchIcon size={17} />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search usernames"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pt-2">
            {debounced === '' ? (
              <EmptyState
                icon={<UserSearch size={28} />}
                title="Find someone to chat with"
                description="Search a username to find friends. You can only message people once they accept your request."
              />
            ) : searching ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                icon={<SearchIcon size={28} />}
                title="No one found"
                description={`No users match “${debounced}”.`}
              />
            ) : (
              <div className="divide-y divide-border-subtle/60">
                {results.map((p) => (
                  <SearchResultRow key={p.uid} uid={p.uid} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RequestsSection />
        </div>
      )}
    </div>
  )
}
