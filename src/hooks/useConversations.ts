'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'
import { isExpired } from '@/lib/dates'
import type { Conversation } from '@/types'

/**
 * Live list of the current user's conversations, newest activity first.
 * Expired conversations (all messages gone) are dropped from the list.
 */
export function useConversations() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [targetUid, setTargetUid] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [ready, setReady] = useState(false)

  if (targetUid !== uid) {
    setTargetUid(uid)
    setConversations([])
    setReady(false)
  }

  useEffect(() => {
    if (!uid) return
    const db = getFirestoreDb()
    const q = query(
      collection(db, 'conversations'),
      where('members', 'array-contains', uid),
      orderBy('lastActivityAt', 'desc'),
    )
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Conversation[] = []
        snap.forEach((doc) => {
          const data = doc.data() as Conversation
          // Hide conversations whose last message has already expired.
          if (data.ephemeralLastMessage && isExpired(data.ephemeralLastMessage.expiresAt)) return
          list.push({ ...data, id: doc.id })
        })
        setConversations(list)
        setReady(true)
      },
      () => setReady(true),
    )
    return unsubscribe
  }, [uid])

  return { conversations, ready }
}
