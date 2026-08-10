/**
 * Chat media upload + metadata extraction. Uploads go through the resumable
 * API so callers get progress, pause/cancel and retry. The caller supplies
 * the destination path (which embeds conversationId + messageId so the rules
 * can validate membership).
 */
'use client'

import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { getFirebaseStorage } from '@/lib/firebase/client'

export interface StartedUpload {
  path: string
  /** Cancellable resumable upload task. */
  task: ReturnType<typeof uploadBytesResumable>
}

/** A dimensioned image/video (width/height/duration in seconds). */
export interface MediaMeta {
  width?: number
  height?: number
  duration?: number
}

/**
 * Read image/video dimensions and duration from a local file. Uses object
 * URLs so nothing is persisted — purely transient metadata for the message.
 */
export function readMediaMeta(file: File): Promise<MediaMeta> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(objectUrl)

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        const meta: MediaMeta = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Math.round(video.duration),
        }
        cleanup()
        resolve(meta)
      }
      video.onerror = () => {
        cleanup()
        resolve({})
      }
      video.src = objectUrl
      return
    }

    const img = new Image()
    img.onload = () => {
      const meta: MediaMeta = { width: img.naturalWidth, height: img.naturalHeight }
      cleanup()
      resolve(meta)
    }
    img.onerror = () => {
      cleanup()
      resolve({})
    }
    img.src = objectUrl
  })
}

/** Start a resumable upload to the given storage path. */
export function startUpload(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): StartedUpload {
  const storage = getFirebaseStorage()
  const fileRef = ref(storage, path)
  const task = uploadBytesResumable(fileRef, file, { contentType: file.type })

  task.on(
    'state_changed',
    (snap) => {
      if (snap.totalBytes > 0) {
        onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
      }
    },
    () => undefined, // errors surface via awaiting task
  )

  return { path, task }
}

/** Await an in-flight upload and resolve with its path + download URL. */
export async function completeUpload(
  upload: StartedUpload,
): Promise<{ path: string; url: string }> {
  const snap = await upload.task
  const url = await getDownloadURL(ref(getFirebaseStorage(), upload.path))
  return { path: snap.ref.fullPath, url }
}
