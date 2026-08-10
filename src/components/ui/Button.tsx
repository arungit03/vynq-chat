'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-strong active:scale-[0.98] disabled:hover:bg-brand',
  secondary:
    'bg-surface-raised text-ink hover:bg-border-subtle/70 active:scale-[0.98]',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-raised hover:text-ink',
  outline:
    'border border-border-subtle bg-transparent text-ink hover:bg-surface-raised',
  danger: 'bg-danger text-white hover:opacity-90 active:scale-[0.98]',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-9 w-9 p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, leftIcon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-semibold transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : leftIcon}
      {children}
    </button>
  )
})
