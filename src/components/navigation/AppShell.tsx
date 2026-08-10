'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CircleDashed, Home, Search, User } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { Avatar } from '@/components/ui/Avatar'
import { LogoMark } from '@/components/ui/Logo'
import { PageLoader } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/status', label: 'Status', icon: CircleDashed },
  { href: '/profile', label: 'Profile', icon: User },
] as const

/**
 * Authenticated application shell.
 *  - Routes unauthenticated users to /login and unverified users to /verify-email.
 *  - Desktop: persistent sidebar. Mobile: top bar + bottom navigation.
 *  - Chat screens hide the bottom navigation for a full-screen immersive view.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, emailVerified, profile } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const inChat = pathname.startsWith('/chat')

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    else if (status === 'authenticated' && !emailVerified) router.replace('/verify-email')
  }, [status, emailVerified, router])

  if (status !== 'authenticated' || !emailVerified) {
    return <PageLoader label="Loading A3Chat…" />
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden w-20 shrink-0 flex-col items-center border-r border-border-subtle bg-surface-elevated py-5 md:flex lg:w-72">
        <div className="flex items-center gap-2.5">
          <LogoMark size={36} />
          <span className="hidden text-lg font-bold text-ink lg:block">
            A3<span className="text-brand">Chat</span>
          </span>
        </div>

        <nav className="mt-8 flex w-full flex-1 flex-col gap-1.5 px-3" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150',
                  active
                    ? 'bg-brand-soft text-brand'
                    : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                )}
                title={item.label}
              >
                <Icon size={22} aria-hidden />
                <span className="hidden lg:block">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <Link
          href="/profile"
          className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-raised"
        >
          <Avatar src={profile?.avatarURL} name={profile?.displayName ?? profile?.username} size={38} />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold text-ink">
              {profile?.displayName ?? profile?.username}
            </p>
            <p className="truncate text-xs text-ink-muted">@{profile?.username}</p>
          </div>
        </Link>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-border-subtle bg-surface-elevated px-4 py-3 md:hidden">
          <LogoMark size={28} />
          <span className="text-base font-bold text-ink">
            A3<span className="text-brand">Chat</span>
          </span>
        </header>

        <main className="min-h-0 flex-1">{children}</main>

        {/* Mobile bottom navigation */}
        {!inChat && (
          <nav
            className="flex shrink-0 border-t border-border-subtle bg-surface-elevated pb-[env(safe-area-inset-bottom)]"
            aria-label="Bottom"
          >
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-colors',
                    active ? 'text-brand' : 'text-ink-muted',
                  )}
                >
                  <Icon size={22} aria-hidden />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
