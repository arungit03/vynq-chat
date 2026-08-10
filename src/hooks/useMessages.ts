'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { isExpired } from '@/lib/dates'
import { INITIAL_MESSAGE_LIMIT, OLDER_MESSAGE_LIMIT } from '@/lib/constants'
import type { Message } from '@/types'

/**
 * Live message subscription for a conversation.
 *
 *  - Latest `INITIAL_MESSAGE_LIMIT` messages, newest-first query but returned
 *    oldest-first for display.
 *  - Older messages load on demand (startAfter the current newest-first tail).
 *  - Expired messages are filtered out client-side (privacy-first: never
 *    render content past its expiresAt even if the backend hasn't cleaned up).
 */
export function useMessages(conversationId: string | null) {
  const [target, setTarget] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const tailRef = useRef<QueryDocumentSnapshot | null>(null)
  const [now, setNow] = useState(() => Date.now())

  if (target !== conversationId) {
    setTarget(conversationId)
    setMessages([])
    setLoading(true)
    setHasMore(false)
  }

  useEffect(() => {
    if (!target) return
    tailRef.current = null
    const db = getFirestoreDb()
    const base = collection(db, 'conversations', target, 'messages')
    const q = query(base, orderBy('createdAt', 'desc'), limit(INITIAL_MESSAGE_LIMIT))

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        tailRef.current = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null
        const list = snap.docs
          .map((d) => ({ ...(d.data() as Message), id: d.id }))
          .reverse() // newest-first → oldest-first for display
        setMessages(list)
        setHasMore(snap.docs.length >= INITIAL_MESSAGE_LIMIT)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsubscribe
  }, [target])

  // Periodic tick to drop messages that have since expired (no backend push).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const loadOlder = useCallback(async () => {
    if (!target || loadingOlder || !tailRef.current) return
    setLoadingOlder(true)
    const db = getFirestoreDb()
    const base = collection(db, 'conversations', target, 'messages')
    const q = query(
      base,
      orderBy('createdAt', 'desc'),
      startAfter(tailRef.current),
      limit(OLDER_MESSAGE_LIMIT),
    )
    try {
      const snap = await getDocs(q)
      tailRef.current = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null
      const older = snap.docs.map((d) => ({ ...(d.data() as Message), id: d.id }))
      setMessages((prev) => [...older.reverse(), ...prev])
      setHasMore(snap.docs.length >= OLDER_MESSAGE_LIMIT)
    } finally {
      setLoadingOlder(false)
    }
  }, [target, loadingOlder])

  const live = messages.filter((m) => !isExpired(m.expiresAt, now))

  return { messages: live, loading, loadingOlder, hasMore, loadOlder }
}
