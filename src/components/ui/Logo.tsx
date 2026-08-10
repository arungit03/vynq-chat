import { cn } from '@/lib/utils'

/**
 * A3Chat brand mark — an original rounded-square emblem combining a chat
 * bubble and a lock, in the brand green.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <rect width="48" height="48" rx="12" fill="#0f9d58" />
      {/* chat bubble tail */}
      <path
        d="M13 24a11 11 0 1 1 22 0 11 11 0 0 1-11 11c-2 0-3.6-.4-5.2-1.3L13 35l1.4-5.2A10.9 10.9 0 0 1 13 24Z"
        fill="#ffffff"
      />
      {/* lock */}
      <path
        d="M24 18.5h-1.2a5 5 0 0 0-5 5v1a5 5 0 0 0 5 5h1.2a5 5 0 0 0 5-5v-1a5 5 0 0 0-5-5Z"
        stroke="#0f9d58"
        strokeWidth="2.4"
      />
      <path d="M22.8 21.5v1.2a1.2 1.2 0 0 0 2.4 0v-1.2a1.2 1.2 0 1 0-2.4 0Z" fill="#0f9d58" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark size={28} />
      <span className="text-lg font-bold tracking-tight text-ink">
        A3<span className="text-brand">Chat</span>
      </span>
    </span>
  )
}
