'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'

/**
 * Live list of the current user's accepted connections (peer uids). Derived
 * from the friendships collection (client-readable; functions create docs).
 */
export function useConnections() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [target, setTarget] = useState<string | null>(null)
  const [connections, setConnections] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  if (target !== uid) {
    setTarget(uid)
    setConnections([])
    setReady(false)
  }

  useEffect(() => {
    if (!uid) return
    const db = getFirestoreDb()
    const q = query(collection(db, 'friendships'), where('members', 'array-contains', uid))
    const unsub = onSnapshot(q, (snap) => {
      const peers = new Set<string>()
      for (const d of snap.docs) {
        const members = d.data()?.members as string[] | undefined
        for (const m of members ?? []) {
          if (m !== uid) peers.add(m)
        }
      }
      setConnections([...peers])
      setReady(true)
    })
    return unsub
  }, [uid])

  return { connections, ready }
}
