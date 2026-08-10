'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Image as ImageIcon, SendHorizontal } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { sendTextMessage } from '@/services/messages'
import { useToast } from '@/components/ui/Toast'
import { mapAuthError } from '@/services/auth'

export interface ComposerProps {
  conversationId: string
}

/**
 * Chat composer. Text-only in Phase 5; the image/video button arrives with
 * media messaging (P6). Sends the message and lets the realtime listener
 * render it — no optimistic echo needed.
 */
export function Composer({ conversationId }: ComposerProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !user || sending) return
    setSending(true)
    try {
      await sendTextMessage(conversationId, user.uid, trimmed)
      setText('')
    } catch (err) {
      toast.error(mapAuthError(err))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function autoGrow() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border-subtle bg-surface-elevated px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        aria-label="Add media (coming soon)"
        title="Media coming soon"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
      >
        <ImageIcon size={20} />
      </button>
      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          autoGrow()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
        }}
        placeholder="Message…"
        aria-label="Message"
        className="max-h-30 min-h-10 flex-1 resize-none rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <button
        type="submit"
        disabled={!text.trim() || sending}
        aria-label="Send message"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-all hover:bg-brand-strong active:scale-95 disabled:opacity-40 disabled:active:scale-100"
      >
        <SendHorizontal size={20} />
      </button>
    </form>
  )
}
