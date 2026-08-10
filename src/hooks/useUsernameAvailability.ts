'use client'

import { useEffect, useState } from 'react'
import { checkUsernameAvailable } from '@/services/usernames'
import { validateUsername } from '@/lib/validation'

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

/**
 * Debounced live availability check. Authoritative uniqueness is enforced by
 * the reserveUsername transaction — this only drives the inline UX.
 *
 * Uses the render-time state-adjustment pattern to reset the result whenever
 * the validated input changes; network state is only set from async callbacks.
 */
export function useUsernameAvailability(raw: string): UsernameStatus {
  const [checkedFor, setCheckedFor] = useState('')
  const [available, setAvailable] = useState<boolean | null>(null)

  const validation = validateUsername(raw)
  const normalized = validation.ok ? validation.normalized : null

  if (normalized && checkedFor !== normalized) {
    setCheckedFor(normalized)
    setAvailable(null)
  }

  useEffect(() => {
    if (!normalized) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const ok = await checkUsernameAvailable(normalized)
        if (!cancelled) setAvailable(ok)
      } catch {
        // Offline/emulator down — leave in "checking" state; don't block typing.
      }
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [normalized])

  if (!normalized) return raw.trim().length > 0 ? 'invalid' : 'idle'
  if (available === null) return 'checking'
  return available ? 'available' : 'taken'
}
