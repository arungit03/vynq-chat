/**
 * Typing indicator writes. Docs live at conversations/{id}/typing/{uid} and
 * carry an expiresAt so they auto-clean; they are ephemeral by design.
 */
'use client'

import { doc, deleteDoc, setDoc, Timestamp } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { TYPING_TTL_MS } from '@/lib/constants'

/** Write (or refresh) the caller's typing indicator. */
export async function setTyping(conversationId: string, uid: string): Promise<void> {
  const db = getFirestoreDb()
  await setDoc(
    doc(db, 'conversations', conversationId, 'typing', uid),
    { uid, expiresAt: Timestamp.fromMillis(Date.now() + TYPING_TTL_MS) },
  )
}

/** Remove the caller's typing indicator. */
export async function clearTyping(conversationId: string, uid: string): Promise<void> {
  const db = getFirestoreDb()
  await deleteDoc(doc(db, 'conversations', conversationId, 'typing', uid)).catch(() => undefined)
}
