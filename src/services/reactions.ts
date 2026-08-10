/**
 * Message reactions. Stored as `reactions: Record<emoji, uid>` on the message
 * (one reaction per user per emoji — the last writer wins for that emoji).
 * Rules let any member toggle reactions.
 */
'use client'

import { doc, updateDoc } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import type { Message } from '@/types'

/**
 * Toggle the caller's reaction emoji on a message. Returns the resulting
 * reactions map (for optimistic UI). Adding/removing is done via full-map
 * rewrite, which the rules permit for the reactions field.
 */
export async function toggleReaction(
  conversationId: string,
  messageId: string,
  uid: string,
  emoji: string,
  current: Message['reactions'],
): Promise<Message['reactions']> {
  const next = { ...(current ?? {}) }
  if (next[emoji] === uid) {
    delete next[emoji]
  } else {
    next[emoji] = uid
  }
  const db = getFirestoreDb()
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
    reactions: next,
  })
  return next
}
