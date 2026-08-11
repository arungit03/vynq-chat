/**
 * Personal settings (userSettings/{uid}). Only the owner may read/write these
 * (rules), and the Cloud Function triggers read the notification flags when
 * deciding whether to send a push.
 */
'use client'

import { doc, setDoc } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'

export interface NotificationPrefs {
  messages: boolean
  requests: boolean
}

/** Persist which notification kinds the user wants to receive. */
export async function updateNotificationPrefs(uid: string, prefs: NotificationPrefs): Promise<void> {
  const db = getFirestoreDb()
  // setDoc with merge so the doc is created on first change (it may not exist
  // yet if the user never opened Settings).
  await setDoc(
    doc(db, 'userSettings', uid),
    {
      notifications: {
        messages: prefs.messages,
        requests: prefs.requests,
        status: true, // retained for forward-compat; status pushes not sent yet
      },
    },
    { merge: true },
  )
}
