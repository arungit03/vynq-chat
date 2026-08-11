'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { useAuth } from '@/features/auth/auth-provider'
import type { UserSettings } from '@/types'

/** Defaults when the doc is absent — all notifications on, receipts on. */
function defaultSettings(uid: string): UserSettings {
  return {
    uid,
    lastSeenVisibility: 'everyone',
    readReceipts: true,
    statusVisibility: 'connections',
    notifications: { messages: true, requests: true, status: true },
  }
}

/**
 * Live subscription to the current user's personal settings. Falls back to
 * sane defaults if the doc doesn't exist yet.
 */
export function useUserSettings() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [target, setTarget] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [ready, setReady] = useState(false)

  if (target !== uid) {
    setTarget(uid)
    setSettings(null)
    setReady(false)
  }

  useEffect(() => {
    if (!uid) return
    const db = getFirestoreDb()
    const unsubscribe = onSnapshot(
      doc(db, 'userSettings', uid),
      (snap) => {
        setSettings(snap.exists() ? ({ ...(snap.data() as UserSettings), uid } as UserSettings) : defaultSettings(uid))
        setReady(true)
      },
      () => {
        setSettings(defaultSettings(uid))
        setReady(true)
      },
    )
    return unsubscribe
  }, [uid])

  return { settings, ready }
}
