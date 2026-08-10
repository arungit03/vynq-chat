/**
 * Status writes: create (upload media then write the expiring status doc),
 * mark as viewed, delete, and list viewers. Statuses disappear after 24h via
 * the same three layers as messages (client filter, cleanup function, TTL).
 */
'use client'

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { startUpload, completeUpload, readMediaMeta } from '@/services/media'
import { deleteStorageObject } from '@/services/storage'
import { STATUS_TTL_MS, statusMediaPath } from '@/lib/constants'
import type { Status, StatusView } from '@/types'

export interface CreateStatusInput {
  file: File
  caption?: string
  onProgress?: (percent: number) => void
}

/**
 * Upload the status media to Storage then create the expiring status doc.
 * Returns the new status id.
 */
export async function createStatus(uid: string, input: CreateStatusInput): Promise<string> {
  const statusId = crypto.randomUUID()
  const path = statusMediaPath(uid, statusId, input.file.name)
  const meta = await readMediaMeta(input.file)
  const upload = startUpload(path, input.file, input.onProgress)
  const { url } = await completeUpload(upload)

  const db = getFirestoreDb()
  await setDoc(doc(db, 'statuses', statusId), {
    ownerId: uid,
    type: input.file.type.startsWith('video/') ? 'video' : 'image',
    mediaPath: path,
    mediaURL: url,
    mediaType: input.file.type,
    mediaWidth: meta.width,
    mediaHeight: meta.height,
    mediaDuration: meta.duration,
    caption: input.caption?.trim() || undefined,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + STATUS_TTL_MS),
  })
  return statusId
}

/** Record that the viewer has seen this status (one view doc per viewer). */
export async function markStatusViewed(statusId: string, viewerId: string): Promise<void> {
  const db = getFirestoreDb()
  await setDoc(doc(db, 'statuses', statusId, 'views', viewerId), {
    viewerId,
    viewedAt: serverTimestamp(),
  })
}

/** Delete a status and its media from Storage. */
export async function deleteStatus(status: Pick<Status, 'id' | 'mediaPath'>): Promise<void> {
  const db = getFirestoreDb()
  if (status.mediaPath) await deleteStorageObject(status.mediaPath)
  await deleteDoc(doc(db, 'statuses', status.id))
}

/** Fetch the viewers of a status (ids → resolve names via publicProfiles). */
export async function listStatusViews(statusId: string): Promise<StatusView[]> {
  const db = getFirestoreDb()
  const snap = await getDocs(collection(db, 'statuses', statusId, 'views'))
  return snap.docs.map((d) => ({ ...(d.data() as StatusView), viewerId: d.id }))
}
