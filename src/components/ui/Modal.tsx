'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

/**
 * Accessible modal built on the native <dialog> element (focus trap, ESC to
 * close, backdrop handling built in).
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onBackdrop = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect()
      const inDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (!inDialog) onClose()
    }
    const onCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    dialog.addEventListener('click', onBackdrop)
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('click', onBackdrop)
      dialog.removeEventListener('cancel', onCancel)
    }
  }, [onClose])

  return (
    <dialog
      ref={ref}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border-subtle bg-surface-elevated p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[1px]',
        'open:flex open:flex-col',
        className,
      )}
      aria-label={title}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className="overflow-y-auto p-5">{children}</div>
    </dialog>
  )
}
