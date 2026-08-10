/**
 * Message + conversation-preview writes. The client writes message docs
 * directly (rules enforce senderId, membership, not-blocked, expiry) and
 * bumps the conversation preview/lastActivity so the home list reorders.
 */
'use client'

import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { MESSAGE_TTL_MS, MAX_REPLY_PREVIEW_LENGTH } from '@/lib/constants'

export interface SendTextResult {
  messageId: string
  expiresAt: Timestamp
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).trimEnd() + '…'
}

/**
 * Write a text message and bump the conversation's expiring preview.
 * Returns the message id + its expiresAt so callers can optimistically render.
 */
export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  text: string,
): Promise<SendTextResult> {
  const db = getFirestoreDb()
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'))
  // Client-computed expiry (server time + 7d is not expressible in rules);
  // the scheduled cleanup + TTL delete authoritatively on the stored value.
  const expiresAt = Timestamp.fromMillis(Date.now() + MESSAGE_TTL_MS)

  await setDoc(messageRef, {
    conversationId,
    senderId,
    type: 'text',
    text,
    createdAt: serverTimestamp(),
    expiresAt,
  })

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ephemeralLastMessage: {
      messageId: messageRef.id,
      senderId,
      type: 'text',
      preview: truncate(text, MAX_REPLY_PREVIEW_LENGTH),
      createdAt: serverTimestamp(),
      expiresAt,
    },
  })

  return { messageId: messageRef.id, expiresAt }
}

/** Mark the conversation as read up to "now" for the given member. */
export async function markConversationRead(
  conversationId: string,
  uid: string,
): Promise<void> {
  const db = getFirestoreDb()
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`lastRead.${uid}`]: serverTimestamp(),
  })
}
