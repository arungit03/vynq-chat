/**
 * Public profile mutations. Updates are intentionally restricted to the
 * editable fields the security rules allow (displayName, bio, avatar).
 */
'use client'

import { doc, updateDoc } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'

export interface ProfilePatch {
  displayName?: string
  bio?: string
  avatarPath?: string
  avatarURL?: string
}

/** Update editable public-profile fields. Empty values clear the field. */
export async function updatePublicProfile(uid: string, patch: ProfilePatch): Promise<void> {
  const db = getFirestoreDb()
  const data: Record<string, string> = {}
  if (patch.displayName !== undefined) data.displayName = patch.displayName.trim()
  if (patch.bio !== undefined) data.bio = patch.bio.trim()
  if (patch.avatarPath !== undefined) data.avatarPath = patch.avatarPath
  if (patch.avatarURL !== undefined) data.avatarURL = patch.avatarURL
  if (Object.keys(data).length === 0) return
  await updateDoc(doc(db, 'publicProfiles', uid), data)
}
