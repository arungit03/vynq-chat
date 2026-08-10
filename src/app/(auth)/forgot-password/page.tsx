'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { mapAuthError, sendPasswordReset } from '@/services/auth'
import { validateEmail } from '@/lib/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const check = validateEmail(email)
    if (!check.ok) {
      setError(check.reason)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      // Never reveal whether an account exists for security reasons.
      setError(mapAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-sm">
      <h1 className="text-xl font-bold text-ink">Reset your password</h1>

      {sent ? (
        <div className="mt-6 text-center">
          <p className="text-sm text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, we sent
            a password-reset link. Check your inbox.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block text-sm font-semibold text-brand hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <p className="text-sm text-ink-muted">
            Enter your email and we’ll send you a link to reset your password.
          </p>
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            leftIcon={<Mail size={17} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Send reset link
          </Button>
          <p className="text-center text-sm text-ink-muted">
            Remembered it?{' '}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
