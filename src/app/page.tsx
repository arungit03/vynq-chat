'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-provider'
import { LogoMark } from '@/components/ui/Logo'

/**
 * Landing gate: routes to the app once auth state resolves.
 */
export default function RootPage() {
  const { status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.replace('/home')
    else if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface">
      <LogoMark size={56} />
      <p className="text-sm text-ink-muted">Messages disappear after 7 days 🔐</p>
    </main>
  )
}
