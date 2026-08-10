'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MailCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/auth-provider'
import { mapAuthError, resendVerificationEmail } from '@/services/auth'
import { reserveUsername } from '@/services/usernames'

const RESEND_COOLDOWN_S = 30

export default function VerifyEmailPage() {
  const router = useRouter()
  const { user, emailVerified, refreshAuth, profile } = useAuth()
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finalizedRef = useRef(false)

  // Auto-check every few seconds so users flow in right after clicking the link.
  useEffect(() => {
    if (emailVerified) return
    const interval = window.setInterval(async () => {
      if (!finalizedRef.current) {
        const refreshed = await refreshAuth()
        if (refreshed?.emailVerified) finalizedRef.current = true
      }
    }, 4000)
    return () => window.clearInterval(interval)
  }, [emailVerified, refreshAuth])

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const interval = window.setInterval(() => setResendCooldown((c) => c - 1), 1000)
    return () => window.clearInterval(interval)
  }, [resendCooldown])

  // When verified, finalize the profile and enter the app.
  useEffect(() => {
    if (!emailVerified) return
    let cancelled = false
    ;(async () => {
      try {
        const username = profile?.username ?? user?.displayName
        if (username && !finalizedRef.current) {
          finalizedRef.current = true
          await reserveUsername(username).catch(() => undefined)
        }
      } finally {
        if (!cancelled) router.replace('/home')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [emailVerified, profile, user, router])

  async function onResend() {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setError(null)
    try {
      await resendVerificationEmail()
      setResendCooldown(RESEND_COOLDOWN_S)
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setResending(false)
    }
  }

  async function onCheck() {
    setChecking(true)
    setError(null)
    try {
      const refreshed = await refreshAuth()
      if (refreshed?.emailVerified) finalizedRef.current = true
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <MailCheck size={26} />
      </div>
      <h1 className="text-xl font-bold text-ink">Verify your email</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">
        We sent a verification link to <span className="font-medium text-ink">{user?.email}</span>.
        Click it, then come back here.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-2.5">
        <Button type="button" className="w-full" onClick={onCheck} loading={checking} leftIcon={<RefreshCw size={16} />}>
          I’ve verified — continue
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onResend}
          loading={resending}
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
        </Button>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Checking automatically every few seconds — you’ll be taken in once it’s verified.
      </p>
    </div>
  )
}
