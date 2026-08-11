/**
 * FCM web client wrapper. All functions are no-ops when push isn't available
 * (emulator, missing VAPID key, or an unsupported browser) so the rest of the
 * app can call them unconditionally.
 */
'use client'

import {
  deleteToken,
  getMessaging,
  getToken,
  onMessage,
  type MessagePayload,
} from 'firebase/messaging'
import { getFirebaseApp, isEmulator } from '@/lib/firebase/client'
import { messagingVapidKey } from '@/lib/firebase/config'

/** Path of the FCM service worker (served as a Next route). */
export const FCM_SW_PATH = '/firebase-messaging-sw.js'

export function messagingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !isEmulator &&
    Boolean(messagingVapidKey) &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    typeof Notification.requestPermission === 'function'
  )
}

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

function getSw(): Promise<ServiceWorkerRegistration | null> {
  if (!messagingSupported()) return Promise.resolve(null)
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker.register(FCM_SW_PATH).catch(() => null)
  }
  return swRegistrationPromise
}

/** Ask the browser for permission (must be triggered by a user gesture). */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!messagingSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Resolve the device's registration token, or null when unavailable. */
export async function getFcmToken(): Promise<string | null> {
  if (!messagingSupported()) return null
  const sw = await getSw()
  if (!sw) return null
  try {
    const messaging = getMessaging(getFirebaseApp())
    return await getToken(messaging, {
      vapidKey: messagingVapidKey,
      serviceWorkerRegistration: sw,
    })
  } catch {
    return null
  }
}

/** Unregister this device's token (disable push). */
export async function clearFcmToken(): Promise<void> {
  if (!messagingSupported()) return
  try {
    const messaging = getMessaging(getFirebaseApp())
    await deleteToken(messaging)
  } catch {
    // token already gone
  }
}

/** Subscribe to notifications received while the app is in the foreground. */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  if (!messagingSupported()) return () => undefined
  return onMessage(getMessaging(getFirebaseApp()), callback)
}
