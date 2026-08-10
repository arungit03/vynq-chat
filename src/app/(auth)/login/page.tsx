'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { loginWithEmail, mapAuthError } from '@/services/auth'
import { validateEmail, validatePassword } from '@/lib/validation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const emailCheck = validateEmail(email)
    const passwordCheck = validatePassword(password)
    const nextErrors: typeof errors = {}
    if (!emailCheck.ok) nextErrors.email = emailCheck.reason
    if (!passwordCheck.ok) nextErrors.password = passwordCheck.reason
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setErrors({})
    try {
      const user = await loginWithEmail(email.trim(), password)
      router.replace(user.emailVerified ? '/home' : '/verify-email')
    } catch (err) {
      setErrors({ form: mapAuthError(err) })
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-sm">
      <h1 className="text-xl font-bold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in to A3Chat</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {errors.form && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {errors.form}
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
          error={errors.email}
          disabled={submitting}
        />

        <div>
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={submitting}
          />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" loading={submitting} leftIcon={<Lock size={16} />}>
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        New to A3Chat?{' '}
        <Link href="/register" className="font-semibold text-brand hover:underline">
          Create account
        </Link>
      </p>
    </div>
  )
}
