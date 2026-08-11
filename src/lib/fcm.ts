/**
 * FCM payload → user-facing text. Deliberately generic: the functions only
 * ever send a type, actorId, username and optional conversationId — never
 * message content — so this maps those to a neutral toast/notification line.
 */
import type { MessagePayload } from 'firebase/messaging'

export interface FcmView {
  title: string
  body: string
  conversationId?: string
  clickUrl: string
}

export function describeFcm(payload: MessagePayload): FcmView | null {
  const data = payload.data ?? {}
  if (!data.type) return null
  const actor = data.username ? `@${data.username}` : 'someone'
  let body = 'New activity'
  switch (data.type) {
    case 'message':
      body = `${actor} sent you a message`
      break
    case 'request':
      body = `${actor} sent you a friend request`
      break
    case 'accepted':
      body = `${actor} accepted your request`
      break
  }
  const conversationId = data.conversationId || undefined
  return {
    title: data.title || 'A3Chat',
    body,
    conversationId,
    clickUrl: data.clickUrl || (conversationId ? `/chat/${conversationId}` : '/'),
  }
}
