'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Eye, Moon, Palette, ShieldAlert, Sun, Monitor } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { useTheme, type ThemePreference } from '@/lib/theme'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useBlockedByMe } from '@/hooks/useBlockedByMe'
import { usePublicProfiles } from '@/hooks/usePublicProfiles'
import { updatePublicProfile } from '@/services/profile'
import { updateNotificationPrefs } from '@/services/settings'
import { unblockUser } from '@/services/blocks'
import { useToast } from '@/components/ui/Toast'
import { Toggle } from '@/components/ui/Toggle'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { mapFunctionError } from '@/lib/callable'
import { cn } from '@/lib/utils'

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-border-subtle px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-ink-muted" aria-hidden>
          {icon}
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/**
 * Settings — appearance (theme), notifications (push prefs), privacy (read
 * receipts) and the blocked-users list with unblock.
 */
export default function SettingsPage() {
  const router = useRouter()
  const toast = useToast()
  const { user, profile, profileReady } = useAuth()
  const { theme, setTheme } = useTheme()
  const { settings } = useUserSettings()
  const { blockedByMe, ready: blockedReady } = useBlockedByMe()
  const blockedIds = [...blockedByMe]
  const { profiles } = usePublicProfiles(blockedIds)

  const uid = user?.uid ?? ''
  const [savingPref, setSavingPref] = useState<'messages' | 'requests' | 'receipts' | null>(null)

  if (!profileReady) return <PageLoader label="Loading settings…" />

  async function setNotificationPref(kind: 'messages' | 'requests', next: boolean) {
    if (!uid) return
    setSavingPref(kind)
    try {
      const prefs = {
        messages: kind === 'messages' ? next : (settings?.notifications.messages ?? true),
        requests: kind === 'requests' ? next : (settings?.notifications.requests ?? true),
      }
      await updateNotificationPrefs(uid, prefs)
    } catch (err) {
      toast.error(mapFunctionError(err, 'Could not save setting'))
    } finally {
      setSavingPref(null)
    }
  }

  async function setReadReceipts(next: boolean) {
    if (!uid) return
    setSavingPref('receipts')
    try {
      await updatePublicProfile(uid, { readReceipts: next })
    } catch (err) {
      toast.error(mapFunctionError(err, 'Could not save setting'))
    } finally {
      setSavingPref(null)
    }
  }

  async function unblock(targetId: string, username: string) {
    try {
      await unblockUser(targetId)
      toast.info(`Unblocked @${username}`)
    } catch (err) {
      toast.error(mapFunctionError(err, 'Could not unblock this user'))
    }
  }

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
        <h1 className="text-lg font-bold text-ink">Settings</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section icon={<Palette size={16} />} title="Appearance">
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = theme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors',
                    active
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-border-subtle text-ink-muted hover:bg-surface-raised hover:text-ink',
                  )}
                >
                  <Icon size={18} aria-hidden />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Section>

        <Section icon={<Bell size={16} />} title="Notifications">
          <Row
            label="New messages"
            hint="Push when someone messages you"
          >
            <Toggle
              checked={settings?.notifications.messages ?? true}
              disabled={savingPref === 'messages'}
              label="New messages notifications"
              onChange={(next) => void setNotificationPref('messages', next)}
            />
          </Row>
          <Row label="Friend requests" hint="Push when someone wants to connect">
            <Toggle
              checked={settings?.notifications.requests ?? true}
              disabled={savingPref === 'requests'}
              label="Friend request notifications"
              onChange={(next) => void setNotificationPref('requests', next)}
            />
          </Row>
        </Section>

        <Section icon={<Eye size={16} />} title="Privacy">
          <Row
            label="Read receipts"
            hint="Let others see when you’ve read their messages"
          >
            <Toggle
              checked={profile?.readReceipts !== false}
              disabled={savingPref === 'receipts'}
              label="Read receipts"
              onChange={(next) => void setReadReceipts(next)}
            />
          </Row>
        </Section>

        <Section icon={<ShieldAlert size={16} />} title="Blocked users">
          {!blockedReady || blockedIds.length === 0 ? (
            <p className="px-1 py-3 text-sm text-ink-muted">
              {blockedReady ? 'No blocked users.' : 'Loading…'}
            </p>
          ) : (
            <div className="space-y-1">
              {blockedIds.map((blockedId) => {
                const p = profiles[blockedId]
                const name = p?.displayName ?? p?.username ?? 'Unknown user'
                const username = p?.username ?? 'user'
                return (
                  <div key={blockedId} className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <Avatar src={p?.avatarURL ?? null} name={name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{name}</p>
                      {p?.username && <p className="truncate text-xs text-ink-muted">@{p.username}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void unblock(blockedId, username)}
                    >
                      Unblock
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        <p className="px-4 py-5 text-center text-xs text-ink-muted">
          Chats disappear after 7 days · Status after 24 hours
        </p>
      </div>
    </div>
  )
}
