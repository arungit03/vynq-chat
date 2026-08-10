/**
 * Username operations: live availability check + server-side reservation.
 */
'use client'

import { doc, getDoc } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { callFunction } from '@/lib/callable'

/** Live availability check against the usernames registry. */
export async function checkUsernameAvailable(normalized: string): Promise<boolean> {
  const db = getFirestoreDb()
  const snap = await getDoc(doc(db, 'usernames', normalized))
  return !snap.exists()
}

/** Reserve a username atomically (idempotent — also finalizes verification). */
export async function reserveUsername(username: string): Promise<{
  username: string
  normalizedUsername: string
}> {
  return callFunction('reserveUsername', { username })
}

/** Change the caller's username atomically. */
export async function changeUsername(username: string): Promise<{
  username: string
  normalizedUsername: string
}> {
  return callFunction('changeUsername', { username })
}
