import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={cn('animate-spin text-brand', className)} aria-hidden />
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div
      className="flex h-full min-h-40 flex-1 flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Spinner size={28} />
      {label && <p className="text-sm text-ink-muted">{label}</p>}
    </div>
  )
}
