'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import type { PublicProfile } from '@/types'

/**
 * Live subscriptions to many public profiles, keyed by uid. Used where a page
 * needs several profiles at once (status list, request rows). `ready` flips
 * true once every subscription has delivered its first snapshot.
 */
export function usePublicProfiles(uids: string[]) {
  const [key, setKey] = useState('')
  const ids = [...new Set(uids)].sort().join('|')
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({})
  const [ready, setReady] = useState(false)

  if (key !== ids) {
    setKey(ids)
    setProfiles({})
    setReady(false)
  }

  useEffect(() => {
    if (!ids) return
    const db = getFirestoreDb()
    let delivered = 0
    const total = ids.split('|').length
    const unsubs = ids.split('|').map((uid) =>
      onSnapshot(doc(db, 'publicProfiles', uid), (snap) => {
        setProfiles((prev) => {
          const next = { ...prev }
          if (snap.exists()) next[uid] = { ...(snap.data() as PublicProfile), uid }
          else delete next[uid]
          return next
        })
        delivered += 1
        if (delivered === total) setReady(true)
      }),
    )
    return () => unsubs.forEach((unsub) => unsub())
  }, [ids])

  return { profiles, ready }
}
