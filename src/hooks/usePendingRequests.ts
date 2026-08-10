'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'
import type { FriendRequest } from '@/types'

export interface PendingRequests {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

/** Live list of pending friend requests in both directions. */
export function usePendingRequests(): PendingRequests {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const [targetUid, setTargetUid] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])

  // Reset when the signed-in user changes (render-time adjustment pattern).
  if (targetUid !== uid) {
    setTargetUid(uid)
    setIncoming([])
    setOutgoing([])
  }

  useEffect(() => {
    if (!uid) return
    const db = getFirestoreDb()
    const incomingQuery = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', uid),
      where('status', '==', 'pending'),
    )
    const outgoingQuery = query(
      collection(db, 'friendRequests'),
      where('senderId', '==', uid),
      where('status', '==', 'pending'),
    )

    const unsubIncoming = onSnapshot(incomingQuery, (snap) => {
      const list: FriendRequest[] = []
      snap.forEach((doc) => list.push({ id: doc.id, ...(doc.data() as Omit<FriendRequest, 'id'>) }))
      setIncoming(list)
    })
    const unsubOutgoing = onSnapshot(outgoingQuery, (snap) => {
      const list: FriendRequest[] = []
      snap.forEach((doc) => list.push({ id: doc.id, ...(doc.data() as Omit<FriendRequest, 'id'>) }))
      setOutgoing(list)
    })
    return () => {
      unsubIncoming()
      unsubOutgoing()
    }
  }, [uid])

  return { incoming, outgoing }
}
