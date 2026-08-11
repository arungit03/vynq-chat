'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import {
  clearFcmToken,
  getFcmToken,
  messagingSupported,
  onForegroundMessage,
  requestNotificationPermission,
} from '@/services/messaging'
import { removeFcmToken, saveFcmToken } from '@/services/notifications'
import { describeFcm } from '@/lib/fcm'
import { useToast } from '@/components/ui/Toast'

export type PushStatus = 'idle' | 'granted' | 'denied' | 'unsupported'

/**
 * Web push lifecycle. `enable()` must be called from a user gesture (the
 * browser only shows the permission prompt then); it requests permission,
 * resolves a token and stores it. Foreground messages surface as in-app
 * toasts; background ones are handled by the service worker. Disabling or
 * signing out unregisters the device token.
 */
export function usePushNotifications(enabled: boolean) {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const toast = useToast()
  const [status, setStatus] = useState<PushStatus>('idle')
  const tokenRef = useRef<string | null>(null)

  // Foreground messages → in-app toast (background handled by the SW).
  useEffect(() => {
    if (!enabled || !uid) return
    return onForegroundMessage((payload) => {
      const view = describeFcm(payload)
      if (view) toast.info(view.body)
    })
  }, [enabled, uid, toast])

  // Tear down the device token when push is disabled or the user signs out.
  useEffect(() => {
    if (!enabled || !uid) return
    return () => {
      const token = tokenRef.current
      tokenRef.current = null
      if (token) void removeFcmToken(uid, token)
      void clearFcmToken()
    }
  }, [enabled, uid])

  /** Request permission + register the token. Call from a click handler. */
  const enable = useCallback(async (): Promise<PushStatus> => {
    const perm = await requestNotificationPermission()
    if (perm !== 'granted') {
      const next: PushStatus = perm === 'unsupported' ? 'unsupported' : 'denied'
      setStatus(next)
      return next
    }
    const token = await getFcmToken()
    if (!token) {
      setStatus('denied')
      return 'denied'
    }
    tokenRef.current = token
    if (uid) await saveFcmToken(uid, token).catch(() => undefined)
    setStatus('granted')
    return 'granted'
  }, [uid])

  return { status, supported: messagingSupported(), enable }
}
