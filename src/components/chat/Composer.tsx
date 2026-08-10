'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Image as ImageIcon, RotateCcw, SendHorizontal, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { sendTextMessage } from '@/services/messages'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import { useToast } from '@/components/ui/Toast'
import { mapAuthError } from '@/services/auth'
import { MAX_MESSAGE_TEXT_LENGTH } from '@/lib/constants'
import { cn } from '@/lib/utils'

export interface ComposerProps {
  conversationId: string
}

/**
 * Chat composer: text send plus image/video attachments. The media flow
 * (validate → preview/caption → resumable upload with progress → write
 * message) lives in useMediaUpload; this renders its states.
 */
export function Composer({ conversationId }: ComposerProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const media = useMediaUpload(conversationId)
  const pending = media.pending
  const busy = media.busy || sending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !user || busy) return
    setSending(true)
    try {
      await sendTextMessage(conversationId, user.uid, trimmed)
      setText('')
    } catch (err) {
      toast.error(mapAuthError(err))
    } finally {
      setSending(false)
      textRef.current?.focus()
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    const error = media.pick(file)
    if (error) toast.error(error)
  }

  function autoGrow() {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <div className="border-t border-border-subtle bg-surface-elevated">
      {/* Pending media preview */}
      {pending && (
        <div className="flex items-center gap-3 px-3 pt-2.5">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-raised">
            {pending.kind === 'video' ? (
              <video src={pending.previewUrl} className="h-full w-full object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pending.previewUrl} alt="Attachment preview" className="h-full w-full object-cover" />
            )}
            {pending.stage === 'uploading' && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-xs font-semibold text-white">
                <span>{pending.progress}%</span>
                <span className="h-1 w-12 overflow-hidden rounded-full bg-white/30">
                  <span
                    className="block h-full bg-white transition-all"
                    style={{ width: `${pending.progress}%` }}
                  />
                </span>
              </span>
            )}
            {pending.stage === 'sending' && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                <SendHorizontal size={18} className="animate-pulse" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <input
              value={pending.caption}
              onChange={(e) => media.setCaption(e.target.value)}
              disabled={pending.stage === 'uploading' || pending.stage === 'sending'}
              placeholder={pending.kind === 'video' ? 'Add a caption…' : 'Add a caption…'}
              aria-label="Caption"
              maxLength={MAX_MESSAGE_TEXT_LENGTH}
              className="h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {pending.stage === 'error' && pending.error && (
              <p className="mt-1 text-xs font-medium text-danger" role="alert">
                {pending.error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            {pending.stage === 'error' ? (
              <button
                onClick={media.retry}
                aria-label="Retry upload"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-strong"
              >
                <RotateCcw size={16} />
              </button>
            ) : pending.stage === 'preview' ? (
              <button
                onClick={media.send}
                disabled={busy}
                aria-label="Send attachment"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-strong disabled:opacity-40"
              >
                <SendHorizontal size={16} />
              </button>
            ) : null}
            <button
              onClick={media.cancel}
              disabled={pending.stage === 'sending'}
              aria-label="Remove attachment"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-40"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-end gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || pending !== null}
          aria-label="Add media"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-40"
        >
          <ImageIcon size={20} />
        </button>
        <textarea
          ref={textRef}
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
          className={cn(
            'max-h-30 min-h-10 flex-1 resize-none rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 transition-colors',
            'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
          )}
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-all hover:bg-brand-strong active:scale-95 disabled:opacity-40 disabled:active:scale-100"
        >
          <SendHorizontal size={20} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFileSelected} aria-hidden tabIndex={-1} />
      </form>
    </div>
  )
}
