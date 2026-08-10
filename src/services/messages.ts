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
import type { MessageType } from '@/types'

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
  return writeMessage(
    conversationId,
    senderId,
    { type: 'text', text },
    truncate(text, MAX_REPLY_PREVIEW_LENGTH),
  )
}

export interface MediaMessageData {
  type: 'image' | 'video'
  mediaPath: string
  mediaURL: string
  mediaType: string
  mediaSize: number
  mediaWidth?: number
  mediaHeight?: number
  mediaDuration?: number
  caption?: string
}

/** Common write path for text and media messages (expiry + preview bump). */
async function writeMessage(
  conversationId: string,
  senderId: string,
  messageData: Record<string, unknown>,
  preview: string,
): Promise<SendTextResult> {
  const db = getFirestoreDb()
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'))
  const expiresAt = Timestamp.fromMillis(Date.now() + MESSAGE_TTL_MS)

  await setDoc(messageRef, {
    conversationId,
    senderId,
    createdAt: serverTimestamp(),
    expiresAt,
    ...messageData,
  })

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ephemeralLastMessage: {
      messageId: messageRef.id,
      senderId,
      type: messageData.type as MessageType,
      preview,
      createdAt: serverTimestamp(),
      expiresAt,
    },
  })

  return { messageId: messageRef.id, expiresAt }
}

/**
 * Write a media message after its upload completes. `caption` is optional
 * and, when present, is also what the ephemeral preview shows.
 */
export async function sendMediaMessage(
  conversationId: string,
  senderId: string,
  data: MediaMessageData,
): Promise<SendTextResult> {
  const preview = data.caption?.trim()
    ? truncate(data.caption, MAX_REPLY_PREVIEW_LENGTH)
    : data.type === 'image'
      ? 'Photo'
      : 'Video'
  return writeMessage(conversationId, senderId, { ...data }, preview)
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
