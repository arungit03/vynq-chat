'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const KIND_STYLES: Record<ToastKind, { icon: ReactNode; ring: string }> = {
  success: { icon: <CheckCircle2 size={18} className="text-brand" />, ring: 'border-brand/30' },
  error: { icon: <XCircle size={18} className="text-danger" />, ring: 'border-danger/30' },
  info: { icon: <Info size={18} className="text-link" />, ring: 'border-link/30' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }])
      window.setTimeout(() => dismiss(id), 3500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const style = KIND_STYLES[toast.kind]
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border bg-surface-elevated px-4 py-2.5 text-sm text-ink shadow-lg',
                'animate-[toast-in_0.18s_ease-out]',
                style.ring,
              )}
            >
              {style.icon}
              <span className="leading-snug">{toast.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
