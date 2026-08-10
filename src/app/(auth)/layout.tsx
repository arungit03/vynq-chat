'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-provider'
import { LogoMark } from '@/components/ui/Logo'

/**
 * Shared shell for authentication screens. Authenticated users are routed
 * away (to Home or Verify-Email) as soon as auth state resolves.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status, emailVerified } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(emailVerified ? '/home' : '/verify-email')
    }
  }, [status, emailVerified, router])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="mb-6">
        <LogoMark size={46} />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-center text-xs text-ink-muted">
        🔐 Chats auto-delete after 7 days · Status after 24 hours
      </p>
    </main>
  )
}
