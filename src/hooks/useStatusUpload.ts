'use client'

import { useCallback, useRef, useState } from 'react'
import { createStatus } from '@/services/statuses'
import { readMediaMeta } from '@/services/media'
import { useAuth } from '@/features/auth/auth-provider'
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_STATUS_IMAGE_SIZE,
  MAX_STATUS_VIDEO_SIZE,
  MAX_STATUS_VIDEO_DURATION_S,
} from '@/lib/constants'

export type StatusUploadStage = 'idle' | 'preview' | 'uploading' | 'error' | 'done'

export interface StatusUploadState {
  file: File | null
  previewUrl: string | null
  caption: string
  stage: StatusUploadStage
  progress: number
  error: string | null
}

export interface UseStatusUploadResult {
  state: StatusUploadState
  pick: (file: File) => string | null
  setCaption: (caption: string) => void
  publish: () => Promise<void>
  reset: () => void
  busy: boolean
}

const IDLE: StatusUploadState = {
  file: null,
  previewUrl: null,
  caption: '',
  stage: 'idle',
  progress: 0,
  error: null,
}

/**
 * Status creation state machine: pick → preview/caption → upload with
 * progress → done. Enforces the 24h privacy rule (expiry is written by the
 * service) and the 30-second video rule.
 */
export function useStatusUpload(): UseStatusUploadResult {
  const { user } = useAuth()
  const [state, setState] = useState<StatusUploadState>(IDLE)
  const busyRef = useRef(false)

  const pick = useCallback((file: File): string | null => {
    const kind = file.type.startsWith('video/') ? 'video' : 'image'
    if (kind === 'image') {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'Use a JPEG, PNG, WEBP or GIF image.'
      if (file.size > MAX_STATUS_IMAGE_SIZE) return 'Image must be under 10 MB.'
    } else {
      if (!ALLOWED_VIDEO_TYPES.has(file.type)) return 'Use an MP4, WEBM or MOV video.'
      if (file.size > MAX_STATUS_VIDEO_SIZE) return 'Video must be under 60 MB.'
    }
    setState({
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      stage: 'preview',
      progress: 0,
      error: null,
    })
    return null
  }, [])

  const setCaption = useCallback((caption: string) => {
    setState((prev) => ({ ...prev, caption }))
  }, [])

  const reset = useCallback(() => {
    setState((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return IDLE
    })
  }, [])

  const publish = useCallback(async () => {
    if (!user || !state.file || busyRef.current) return
    if (state.stage === 'uploading' || state.stage === 'done') return

    // 30-second rule for videos: check before uploading.
    if (state.file.type.startsWith('video/')) {
      const meta = await readMediaMeta(state.file)
      if (meta.duration && meta.duration > MAX_STATUS_VIDEO_DURATION_S) {
        setState((prev) => ({
          ...prev,
          stage: 'error',
          error: `Videos must be under ${MAX_STATUS_VIDEO_DURATION_S} seconds.`,
        }))
        return
      }
    }

    busyRef.current = true
    setState((prev) => ({ ...prev, stage: 'uploading', progress: 0, error: null }))
    try {
      await createStatus(user.uid, {
        file: state.file,
        caption: state.caption.trim() || undefined,
        onProgress: (percent) => setState((prev) => ({ ...prev, progress: percent })),
      })
      setState((prev) => ({ ...prev, stage: 'done', progress: 100 }))
    } catch {
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: 'Upload failed — check your connection and retry.',
      }))
    } finally {
      busyRef.current = false
    }
  }, [user, state.file, state.stage, state.caption])

  return {
    state,
    pick,
    setCaption,
    publish,
    reset,
    busy: state.stage === 'uploading',
  }
}
