'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'
import type { RelationshipState } from '@/types'

/**
 * Live relationship between the signed-in user and `otherUid`:
 * none | outgoing_pending | incoming_pending | connected | blocked.
 *
 * Subscribes to the deterministic friendship, both direction request docs,
 * and both direction block docs. When uid changes we reset state during
 * render (adjustment pattern) then re-subscribe in an effect.
 */
export function useRelationshipState(otherUid: string | null | undefined): RelationshipState {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const [target, setTarget] = useState<string | null>(null)
  const [state, setState] = useState<RelationshipState>('none')

  if (otherUid && target !== otherUid) {
    setTarget(otherUid)
    setState('none')
  }

  useEffect(() => {
    if (!uid || !target) return
    const db = getFirestoreDb()
    const key = [uid, target].sort().join('_')

    const unsubscribes = [
      onSnapshot(doc(db, 'friendships', key), (snap) => {
        if (snap.exists()) setState('connected')
      }),
      onSnapshot(doc(db, 'friendRequests', `${uid}_${target}`), (snap) => {
        if (!snap.exists()) return
        const s = snap.data()?.status
        if (s === 'pending') setState('outgoing_pending')
        else if (s === 'accepted') setState('connected')
      }),
      onSnapshot(doc(db, 'friendRequests', `${target}_${uid}`), (snap) => {
        if (!snap.exists()) return
        const s = snap.data()?.status
        if (s === 'pending') setState('incoming_pending')
        else if (s === 'accepted') setState('connected')
      }),
      onSnapshot(doc(db, 'blocks', `${uid}_${target}`), (snap) => {
        if (snap.exists()) setState('blocked')
      }),
      onSnapshot(doc(db, 'blocks', `${target}_${uid}`), (snap) => {
        if (snap.exists()) setState('blocked')
      }),
    ]
    return () => unsubscribes.forEach((u) => u())
  }, [uid, target])

  return state
}
