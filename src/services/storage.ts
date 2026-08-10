/**
 * Cloud Storage operations: avatar upload + object deletion.
 *
 * Privacy note: after a successful avatar upload the caller is responsible
 * for persisting `path`/`url` to publicProfiles AND deleting the previous
 * avatar file (see ProfileEditModal) so no orphaned media lingers.
 */
'use client'

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage'
import { getFirebaseStorage } from '@/lib/firebase/client'
import { avatarPath } from '@/lib/constants'

export interface UploadResult {
  path: string
  url: string
}

function extFromType(type: string): string {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'img'
}

/**
 * Upload an avatar image. Filename is timestamped so a replacement never
 * collides with the previous file (which the caller then deletes).
 * `onProgress` receives a 0–100 percentage.
 */
export async function uploadAvatar(
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const storage = getFirebaseStorage()
  const path = avatarPath(uid, `avatar-${Date.now()}.${extFromType(file.type)}`)
  const fileRef = ref(storage, path)

  const task = uploadBytesResumable(fileRef, file, { contentType: file.type })

  return new Promise<UploadResult>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (snap.totalBytes > 0) {
          onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
        }
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(fileRef)
        resolve({ path, url })
      },
    )
  })
}

/** Delete a storage object by path (no-op on empty path). */
export async function deleteStorageObject(path: string | undefined | null): Promise<void> {
  if (!path) return
  try {
    await deleteObject(ref(getFirebaseStorage(), path))
  } catch {
    // Best effort — the object may already be gone (e.g. re-upload race).
  }
}
