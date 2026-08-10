'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import type { PublicProfile } from '@/types'

/** Live subscription to a single public profile. */
export function usePublicProfile(uid: string | null | undefined) {
  const [target, setTarget] = useState<string | null>(null)
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [ready, setReady] = useState(false)

  if (uid && target !== uid) {
    setTarget(uid)
    setProfile(null)
    setReady(false)
  }

  useEffect(() => {
    if (!target) return
    const db = getFirestoreDb()
    const unsubscribe = onSnapshot(
      doc(db, 'publicProfiles', target),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as PublicProfile) : null)
        setReady(true)
      },
      () => {
        setProfile(null)
        setReady(true)
      },
    )
    return unsubscribe
  }, [target])

  return { profile, ready }
}
