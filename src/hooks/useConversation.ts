'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import type { Conversation } from '@/types'

/** Live subscription to a single conversation document. */
export function useConversation(conversationId: string | null) {
  const [target, setTarget] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [ready, setReady] = useState(false)

  if (target !== conversationId) {
    setTarget(conversationId)
    setConversation(null)
    setReady(false)
  }

  useEffect(() => {
    if (!target) return
    const db = getFirestoreDb()
    const unsubscribe = onSnapshot(
      doc(db, 'conversations', target),
      (snap) => {
        setConversation(snap.exists() ? ({ ...(snap.data() as Conversation), id: snap.id } as Conversation) : null)
        setReady(true)
      },
      () => {
        setConversation(null)
        setReady(true)
      },
    )
    return unsubscribe
  }, [target])

  return { conversation, ready }
}
