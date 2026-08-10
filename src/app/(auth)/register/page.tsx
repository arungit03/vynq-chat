'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AtSign, CheckCircle2, Loader2, Mail, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { useUsernameAvailability, type UsernameStatus } from '@/hooks/useUsernameAvailability'
import {
  deleteAuthUser,
  mapAuthError,
  registerWithEmail,
  sendVerificationEmail,
} from '@/services/auth'
import { reserveUsername } from '@/services/usernames'
import { mapFunctionError } from '@/lib/callable'
import {
  passwordStrength,
  passwordStrengthLabel,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/lib/validation'

function UsernameFeedback({ status }: { status: UsernameStatus }) {
  if (status === 'idle') return null
  if (status === 'checking')
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
        <Loader2 size={12} className="animate-spin" /> Checking…
      </p>
    )
  if (status === 'available')
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">
        <CheckCircle2 size={13} /> Username available
      </p>
    )
  if (status === 'taken')
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
        <XCircle size={13} /> Username already taken
      </p>
    )
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
      <XCircle size={13} /> Invalid username
    </p>
  )
}

function PasswordStrength({ password }: { password: string }) {
  if (password.length === 0) return null
  const score = passwordStrength(password)
  const colors = ['bg-danger', 'bg-amber-500', 'bg-brand/70', 'bg-brand']
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score - 1] : 'bg-border-subtle'}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Strength: <span className="font-medium">{passwordStrengthLabel(score)}</span>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string; form?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const usernameStatus = useUsernameAvailability(username)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const u = validateUsername(username)
    const em = validateEmail(email)
    const pw = validatePassword(password)
    const nextErrors: typeof errors = {}
    if (!u.ok) nextErrors.username = u.reason
    if (!em.ok) nextErrors.email = em.reason
    if (!pw.ok) nextErrors.password = pw.reason
    setErrors(nextErrors)
    const normalized = u.ok ? u.normalized : null
    if (!normalized || !em.ok || !pw.ok) return
    if (usernameStatus === 'taken') {
      setErrors({ username: 'Username already taken' })
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      const user = await registerWithEmail(email.trim(), password)
      try {
        await reserveUsername(normalized)
      } catch (reserveError) {
        // Username lost in the race — roll the account back so the user can
        // pick another username rather than being stranded half-set-up.
        await deleteAuthUser().catch(() => undefined)
        setErrors({ username: mapFunctionError(reserveError, 'Username already taken') })
        setSubmitting(false)
        return
      }
      await sendVerificationEmail(user).catch(() => undefined)
      router.replace('/verify-email')
    } catch (err) {
      setErrors({ form: mapAuthError(err) })
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-sm">
      <h1 className="text-xl font-bold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-muted">Pick a unique username — it’s how friends find you.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {errors.form && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {errors.form}
          </p>
        )}

        <div>
          <Input
            label="Username"
            placeholder="alex"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            leftIcon={<AtSign size={17} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            disabled={submitting}
            aria-describedby="username-hint"
          />
          <p id="username-hint" className="mt-1.5 text-xs text-ink-muted">
            3–20 characters: letters, numbers, _ and .
          </p>
          <UsernameFeedback status={usernameStatus} />
        </div>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={submitting}
          />
          <PasswordStrength password={password} />
        </div>

        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
