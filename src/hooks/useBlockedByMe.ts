'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'

/**
 * Uids the current user has blocked (blocks where blockerId == me). Unlike
 * useBlockedUids this is one-directional, so "Block"/"Unblock" actions can
 * target exactly the right doc.
 */
export function useBlockedByMe() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [target, setTarget] = useState<string | null>(null)
  const [blockedIds, setBlockedIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  if (target !== uid) {
    setTarget(uid)
    setBlockedIds([])
    setReady(false)
  }

  useEffect(() => {
    if (!uid) return
    const db = getFirestoreDb()
    const q = query(collection(db, 'blocks'), where('blockerId', '==', uid))
    const unsubscribe = onSnapshot(q, (snap) => {
      setBlockedIds(snap.docs.map((d) => (d.data() as { blockedId: string }).blockedId))
      setReady(true)
    })
    return unsubscribe
  }, [uid])

  return { blockedByMe: new Set(blockedIds), ready }
}
