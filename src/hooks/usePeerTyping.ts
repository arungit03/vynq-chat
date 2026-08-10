'use client'

import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { isExpired } from '@/lib/dates'
import { TYPING_DISPLAY_MS } from '@/lib/constants'

/**
 * Live "peer is typing" state. Subscribes to the peer's typing doc for this
 * conversation; true while the doc exists and hasn't expired. A grace timer
 * keeps the label visible briefly after the doc disappears.
 */
export function usePeerTyping(conversationId: string | null, peerUid: string | null) {
  const [typing, setTyping] = useState(false)
  const lastSeenActive = useRef(0)

  // Reset when the conversation or peer changes (render-time adjustment).
  const activeKey = conversationId && peerUid ? `${conversationId}:${peerUid}` : null
  const [subKey, setSubKey] = useState<string | null>(null)
  if (subKey !== activeKey) {
    setSubKey(activeKey)
    setTyping(false)
  }

  useEffect(() => {
    if (!activeKey) return
    // Fresh peer subscription → reset the grace window.
    lastSeenActive.current = 0
    const [conversationId, peerUid] = activeKey.split(':')
    const db = getFirestoreDb()
    const ref = doc(db, 'conversations', conversationId, 'typing', peerUid)
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists() && !isExpired(snap.data()?.expiresAt)) {
        setTyping(true)
        lastSeenActive.current = Date.now()
      } else if (Date.now() - lastSeenActive.current > TYPING_DISPLAY_MS) {
        setTyping(false)
      }
    })
    return unsubscribe
  }, [activeKey])

  return typing
}
