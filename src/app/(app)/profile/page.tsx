'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, Pencil, Shield } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/auth-provider'
import { ProfileEditModal } from '@/components/profile/ProfileEditModal'
import { formatDate } from '@/lib/dates'

/**
 * Profile — the user's own public profile card plus a settings entry point.
 * Editing opens ProfileEditModal (displayName, bio, avatar, username).
 */
export default function ProfilePage() {
  const { profile, profileReady } = useAuth()
  const [editing, setEditing] = useState(false)

  if (!profileReady) return <PageLoader label="Loading profile…" />
  if (!profile) return <PageLoader label="Profile not ready…" />

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle bg-surface-elevated px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Profile</h1>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)} leftIcon={<Pencil size={14} />}>
          Edit
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-8">
          {/* Identity card */}
          <div className="flex flex-col items-center text-center">
            <Avatar
              src={profile.avatarURL ?? null}
              name={profile.displayName ?? profile.username}
              size={104}
            />
            <h2 className="mt-4 text-xl font-bold text-ink">
              {profile.displayName || profile.username}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">@{profile.username}</p>
            {profile.bio ? (
              <p className="mt-3 max-w-sm whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">No bio yet — tell people a little about yourself.</p>
            )}

            <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-muted">
              <Calendar size={13} aria-hidden />
              Joined {formatDate(profile.createdAt)}
            </div>
          </div>

          {/* Divider + privacy/security shortcut */}
          <div className="my-8 h-px bg-border-subtle" />
          <Link
            href="/settings"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
          >
            <Shield size={18} className="text-ink-muted" aria-hidden />
            Privacy & security
            <ChevronRight size={16} className="ml-auto text-ink-muted" aria-hidden />
          </Link>
          <p className="mt-6 text-center text-xs text-ink-muted">
            Chats disappear after 7 days · Status after 24 hours
          </p>
        </div>
      </div>

      <ProfileEditModal open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}
