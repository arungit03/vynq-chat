/**
 * FCM registration-token storage. Tokens live at fcmTokens/{uid}/tokens/{token}
 * (owner-write, functions-read) so the notification triggers can address a
 * user across devices. Deleting a token is how "disable" unsubscribes.
 */
'use client'

import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  const db = getFirestoreDb()
  await setDoc(doc(db, 'fcmTokens', uid, 'tokens', token), {
    uid,
    token,
    platform: 'web',
    createdAt: serverTimestamp(),
    lastUsedAt: serverTimestamp(),
  })
}

export async function removeFcmToken(uid: string, token: string): Promise<void> {
  const db = getFirestoreDb()
  await deleteDoc(doc(db, 'fcmTokens', uid, 'tokens', token)).catch(() => undefined)
}
