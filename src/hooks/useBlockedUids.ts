'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'

/**
 * Uids that have a block relationship with the current user (either I blocked
 * them or they blocked me). Used to exclude blocked users from connection-wide
 * queries like statuses, where one blocked doc would otherwise fail the read.
 */
export function useBlockedUids() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [target, setTarget] = useState<string | null>(null)
  const [blockedByMe, setBlockedByMe] = useState<string[]>([])
  const [blockedMe, setBlockedMe] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  if (target !== uid) {
    setTarget(uid)
    setBlockedByMe([])
    setBlockedMe([])
    setReady(false)
  }

  useEffect(() => {
    if (!uid) return
    const db = getFirestoreDb()
    const qByMe = query(collection(db, 'blocks'), where('blockerId', '==', uid))
    const qOnMe = query(collection(db, 'blocks'), where('blockedId', '==', uid))
    const unsubByMe = onSnapshot(qByMe, (snap) => {
      setBlockedByMe(snap.docs.map((d) => (d.data() as { blockedId: string }).blockedId))
      setReady(true)
    })
    const unsubOnMe = onSnapshot(qOnMe, (snap) => {
      setBlockedMe(snap.docs.map((d) => (d.data() as { blockerId: string }).blockerId))
      setReady(true)
    })
    return () => {
      unsubByMe()
      unsubOnMe()
    }
  }, [uid])

  const blocked = new Set<string>([...blockedByMe, ...blockedMe])
  return { blocked, ready }
}
