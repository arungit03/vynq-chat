'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { isExpired } from '@/lib/dates'
import { CLIENT_EXPIRY_TICK_MS } from '@/lib/constants'
import type { Status } from '@/types'

/**
 * Live statuses for a set of owner ids (the current user + connections).
 * `where('ownerId','in',…)` supports at most 10 values — callers should cap
 * the connection list. Expired statuses are dropped client-side on a tick,
 * matching the 24h privacy rule (backend cleanup/TTL are the other layers).
 */
export function useStatuses(ownerIds: string[]) {
  const [key, setKey] = useState('')
  const ids = [...new Set(ownerIds)].sort().join('|')
  const [statuses, setStatuses] = useState<Status[]>([])
  const [ready, setReady] = useState(false)
  const [, setTick] = useState(0)

  if (key !== ids) {
    setKey(ids)
    setStatuses([])
    setReady(false)
  }

  useEffect(() => {
    if (!ids) return
    const ownerList = ids.split('|')
    if (ownerList.length === 0 || ownerList.length > 10) return
    const db = getFirestoreDb()
    const q = query(
      collection(db, 'statuses'),
      where('ownerId', 'in', ownerList),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ ...(d.data() as Status), id: d.id }))
      setStatuses(all)
      setReady(true)
    })
    // Re-evaluate expiry periodically so expired statuses vanish without a reload.
    const timer = window.setInterval(() => setTick((t) => t + 1), CLIENT_EXPIRY_TICK_MS)
    return () => {
      unsub()
      window.clearInterval(timer)
    }
  }, [ids])

  const live = statuses.filter((s) => !isExpired(s.expiresAt))
  return { statuses: live, ready }
}
