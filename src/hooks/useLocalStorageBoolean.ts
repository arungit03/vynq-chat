'use client'

import { useCallback, useSyncExternalStore } from 'react'

const storageKey = (key: string) => `a3chat:${key}`

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

/**
 * A persisted boolean (localStorage) with a hydration-safe read: the server
 * snapshot is always falsy, and the client flips to the stored value on mount
 * without a mismatch. `set` also dispatches a storage event so the same tab
 * updates immediately.
 */
export function useLocalStorageBoolean(key: string) {
  const fullKey = storageKey(key)

  const snapshot = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(fullKey),
    () => null,
  )

  const value = snapshot === '1'
  const set = useCallback(
    (next: boolean) => {
      if (next) window.localStorage.setItem(fullKey, '1')
      else window.localStorage.removeItem(fullKey)
      window.dispatchEvent(new Event('storage'))
    },
    [fullKey],
  )

  return [value, set] as const
}
