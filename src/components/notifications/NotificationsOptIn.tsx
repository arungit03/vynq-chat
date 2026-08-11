'use client'

import { Bell, BellOff, X } from 'lucide-react'
import type { PushStatus } from '@/hooks/usePushNotifications'

export interface NotificationsOptInProps {
  status: PushStatus
  onEnable: () => void
  onDismiss: () => void
}

/**
 * Slim opt-in banner for push notifications. Shows while the status is unknown
 * (invite) or denied (blocked hint). Renders nothing once enabled or on
 * browsers where push is unavailable.
 */
export function NotificationsOptIn({ status, onEnable, onDismiss }: NotificationsOptInProps) {
  if (status === 'granted' || status === 'unsupported') return null

  const blocked = status === 'denied'

  return (
    <div className="mx-3 mt-2 rounded-xl border border-border-subtle bg-surface-elevated p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          {blocked ? <BellOff size={18} /> : <Bell size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {blocked ? 'Notifications are blocked' : 'Get notified'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            {blocked
              ? 'Enable notifications in your browser settings to get message and request alerts. Nothing private is ever stored.'
              : 'We’ll let you know about new messages and requests. Push payloads carry no message content.'}
          </p>
          <div className="mt-2 flex gap-2">
            {!blocked && (
              <button
                onClick={onEnable}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                Enable notifications
              </button>
            )}
            <button
              onClick={onDismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
            >
              {blocked ? 'Dismiss' : 'Not now'}
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification prompt"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted/60 transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
