'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, ImagePlus, Send } from 'lucide-react'
import { useStatusUpload } from '@/hooks/useStatusUpload'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'
import { MAX_MESSAGE_TEXT_LENGTH } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Create a status: pick an image/video (video ≤ 30s), add a caption, upload
 * and publish. Statuses self-delete after 24 hours.
 */
export default function CreateStatusPage() {
  const router = useRouter()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const { state, pick, setCaption, publish, busy } = useStatusUpload()

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const error = pick(file)
    if (error) toast.error(error)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border-subtle bg-surface-elevated px-3 py-2.5">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-ink">New status</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {state.stage === 'idle' || state.stage === 'done' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors hover:bg-brand/20"
              aria-label="Pick a photo or video"
            >
              <ImagePlus size={36} />
            </button>
            <div>
              <p className="text-sm font-medium text-ink">Share a moment</p>
              <p className="mt-1 max-w-xs text-xs text-ink-muted">
                Pick a photo or a short video (max 30 seconds). It disappears
                after 24 hours.
              </p>
            </div>
            {state.stage === 'done' && (
              <button
                onClick={() => router.replace('/status')}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                View my status
              </button>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Preview */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-4">
              {state.previewUrl &&
                (state.file?.type.startsWith('video/') ? (
                  <video
                    src={state.previewUrl}
                    className="max-h-full max-w-full rounded-xl object-contain"
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.previewUrl}
                    alt="Status preview"
                    className="max-h-full max-w-full rounded-xl object-contain"
                  />
                ))}
              {state.stage === 'uploading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/50 text-white">
                  <span className="text-sm font-semibold">{state.progress}%</span>
                  <span className="h-1.5 w-40 overflow-hidden rounded-full bg-white/25">
                    <span
                      className="block h-full rounded-full bg-white transition-all"
                      style={{ width: `${state.progress}%` }}
                    />
                  </span>
                </div>
              )}
            </div>

            {/* Caption + actions */}
            <div className="border-t border-border-subtle bg-surface-elevated p-3">
              {state.stage === 'error' && state.error && (
                <p className="mb-2 text-xs font-medium text-danger" role="alert">
                  {state.error}
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={state.caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={busy}
                  placeholder="Add a caption…"
                  aria-label="Caption"
                  maxLength={MAX_MESSAGE_TEXT_LENGTH}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border-subtle bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  onClick={() => void publish()}
                  disabled={busy}
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-strong disabled:opacity-50',
                  )}
                  aria-label="Publish status"
                >
                  {state.stage === 'uploading' ? <Spinner /> : <Send size={18} />}
                </button>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="mt-2 flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-40"
                aria-label="Replace media"
              >
                <Camera size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={onFileSelected}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  )
}
