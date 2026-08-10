'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'
import type { Status } from '@/types'

/**
 * Which of the given statuses has the current user already viewed. Subscribes
 * to each status's `views/{myUid}` doc (existence = viewed) so rings update
 * live the moment the viewer records a view.
 */
export function useViewedStatuses(statuses: Status[]) {
  const { user } = useAuth()
  const myUid = user?.uid ?? ''
  const [key, setKey] = useState('')
  const ids = statuses.map((s) => s.id).sort().join('|')
  const [viewed, setViewed] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)

  if (key !== ids) {
    setKey(ids)
    setViewed({})
    setReady(false)
  }

  useEffect(() => {
    if (!myUid || !ids) return
    const db = getFirestoreDb()
    const unsubs = ids.split('|').map((statusId) =>
      onSnapshot(doc(db, 'statuses', statusId, 'views', myUid), (snap) => {
        setViewed((prev) => ({ ...prev, [statusId]: snap.exists() }))
        setReady(true)
      }),
    )
    return () => unsubs.forEach((unsub) => unsub())
  }, [ids, myUid])

  return { viewed, ready }
}
