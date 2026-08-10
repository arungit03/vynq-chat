'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/Input'

/** Password input with an accessible show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  props,
  ref,
) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoComplete="current-password"
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      }
      {...props}
    />
  )
})
