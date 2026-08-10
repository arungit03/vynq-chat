'use client'

import { useCallback, useRef, useState } from 'react'
import { startUpload, completeUpload, readMediaMeta, type StartedUpload } from '@/services/media'
import { sendMediaMessage } from '@/services/messages'
import { useAuth } from '@/features/auth/auth-provider'
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_CHAT_VIDEO_SIZE,
  MAX_CHAT_VIDEO_DURATION_S,
  chatMediaPath,
} from '@/lib/constants'
import type { ReplyRef } from '@/types'
export type MediaStage = 'idle' | 'preview' | 'uploading' | 'error' | 'sending'

export type MediaKind = 'image' | 'video'

export interface PendingMedia {
  file: File
  kind: MediaKind
  previewUrl: string
  stage: MediaStage
  progress: number
  error?: string
  caption: string
}

export interface UseMediaUploadResult {
  pending: PendingMedia | null
  pick: (file: File) => string | null // returns an error message or null
  setCaption: (caption: string) => void
  send: () => Promise<boolean> // true when a message was written
  cancel: () => void
  retry: () => Promise<boolean>
  busy: boolean
}

/** Validate a picked file; returns a human error string or null. */
function validateMedia(file: File, kind: MediaKind): string | null {
  if (kind === 'image') {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'Use a JPEG, PNG, WEBP or GIF image.'
    if (file.size > MAX_IMAGE_SIZE) return 'Image must be under 10 MB.'
  } else {
    if (!ALLOWED_VIDEO_TYPES.has(file.type)) return 'Use an MP4, WEBM or MOV video.'
    if (file.size > MAX_CHAT_VIDEO_SIZE) return 'Video must be under 60 MB.'
  }
  return null
}

/**
 * Manages a single in-flight media attachment: validate → preview →
 * resumable upload (progress, cancel, retry) → message write. The optional
 * `replyTo` is attached to the written message.
 */
export function useMediaUpload(
  conversationId: string,
  replyTo: ReplyRef | null = null,
): UseMediaUploadResult {
  const { user } = useAuth()
  const [pending, setPending] = useState<PendingMedia | null>(null)
  const uploadRef = useRef<StartedUpload | null>(null)

  const pick = useCallback((file: File): string | null => {
    const kind: MediaKind = file.type.startsWith('video/') ? 'video' : 'image'
    const error = validateMedia(file, kind)
    if (error) return error
    setPending({
      file,
      kind,
      previewUrl: URL.createObjectURL(file),
      stage: 'preview',
      progress: 0,
      caption: '',
    })
    return null
  }, [])

  const setCaption = useCallback((caption: string) => {
    setPending((prev) => (prev ? { ...prev, caption } : prev))
  }, [])

  const clear = useCallback(() => {
    if (uploadRef.current) {
      try {
        uploadRef.current.task.cancel()
      } catch {
        // already finished
      }
    }
    uploadRef.current = null
    setPending((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }, [])

  const cancel = useCallback(() => clear(), [clear])

  const beginUpload = useCallback(
    async (target: PendingMedia): Promise<boolean> => {
      if (!user) return false
      // Generate the message id up-front so the storage path is stable.
      const messageId = crypto.randomUUID()
      const path = chatMediaPath(conversationId, messageId, target.file.name)
      const meta = await readMediaMeta(target.file)

      const upload = startUpload(path, target.file, (percent) => {
        setPending((prev) => (prev && prev.file === target.file ? { ...prev, progress: percent } : prev))
      })
      uploadRef.current = upload

      setPending((prev) =>
        prev && prev.file === target.file ? { ...prev, stage: 'uploading' } : prev,
      )

      try {
        const { url } = await completeUpload(upload)
        setPending((prev) =>
          prev && prev.file === target.file ? { ...prev, stage: 'sending' } : prev,
        )
        await sendMediaMessage(conversationId, user.uid, {
          type: target.kind,
          mediaPath: path,
          mediaURL: url,
          mediaType: target.file.type,
          mediaSize: target.file.size,
          mediaWidth: meta.width,
          mediaHeight: meta.height,
          mediaDuration: meta.duration,
          caption: target.caption.trim() || undefined,
        }, replyTo ?? undefined)
        clear()
        return true
      } catch {
        setPending((prev) =>
          prev && prev.file === target.file
            ? { ...prev, stage: 'error', error: 'Upload failed — check your connection and retry.' }
            : prev,
        )
        return false
      }
    },
    [conversationId, user, clear, replyTo],
  )

  const send = useCallback(async (): Promise<boolean> => {
    if (!pending || pending.stage === 'uploading' || pending.stage === 'sending') return false

    // Duration rule for videos: check before uploading.
    if (pending.kind === 'video' && pending.file.type.startsWith('video/')) {
      const meta = await readMediaMeta(pending.file)
      if (meta.duration && meta.duration > MAX_CHAT_VIDEO_DURATION_S) {
        setPending((prev) =>
          prev ? { ...prev, stage: 'error', error: `Videos must be under ${MAX_CHAT_VIDEO_DURATION_S}s.` } : prev,
        )
        return false
      }
    }

    return beginUpload(pending)
  }, [pending, beginUpload])

  const retry = useCallback(async (): Promise<boolean> => {
    if (!pending) return false
    return beginUpload(pending)
  }, [pending, beginUpload])

  return {
    pending,
    pick,
    setCaption,
    send,
    cancel,
    retry,
    busy: pending?.stage === 'uploading' || pending?.stage === 'sending',
  }
}
