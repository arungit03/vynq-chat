/**
 * Push notification triggers (FCM). Fires on friend requests, accepted
 * friendships and new messages, and addresses the recipient's registered
 * devices via fcmTokens/{uid}/tokens.
 *
 * Privacy: payloads carry only a type, actorId, username and deep link —
 * NEVER message content — and each recipient's notification preference
 * (userSettings) is honored. Stale tokens are pruned as FCM reports them.
 */
import * as admin from 'firebase-admin'
import { db, functions } from './shared'

interface PushPayload {
  type: 'message' | 'request' | 'accepted'
  actorId: string
  username: string
  title: string
  body: string
  conversationId?: string
}

async function readUsername(uid: string): Promise<string> {
  const snap = await db.doc(`publicProfiles/${uid}`).get()
  return (snap.data()?.username as string | undefined) ?? 'someone'
}

async function notificationsEnabled(uid: string, kind: 'messages' | 'requests'): Promise<boolean> {
  const snap = await db.doc(`userSettings/${uid}`).get()
  const flags = snap.data()?.notifications as Record<string, boolean> | undefined
  return flags?.[kind] !== false
}

/** True if either user has blocked the other (blocks are symmetric). */
async function blockedBetween(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([
    db.doc(`blocks/${a}_${b}`).get(),
    db.doc(`blocks/${b}_${a}`).get(),
  ])
  return x.exists || y.exists
}

/** Fan a generic push out to all of the recipient's devices. */
async function sendPush(recipientUid: string, payload: PushPayload): Promise<void> {
  const tokensSnap = await db.collection(`fcmTokens/${recipientUid}/tokens`).get()
  const tokens = tokensSnap.docs.map((d) => d.id)
  if (tokens.length === 0) return

  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: {
      type: payload.type,
      actorId: payload.actorId,
      username: payload.username,
      title: payload.title,
      body: payload.body,
      clickUrl: payload.conversationId ? `/chat/${payload.conversationId}` : '/',
      ...(payload.conversationId ? { conversationId: payload.conversationId } : {}),
    },
  })

  // Remove tokens FCM no longer recognizes (device uninstalled / revoked).
  const stale: string[] = []
  result.responses.forEach((response, i) => {
    const code = response.error?.code
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      stale.push(tokens[i])
    }
  })
  if (stale.length > 0) {
    await Promise.all(
      stale.map((token) => db.doc(`fcmTokens/${recipientUid}/tokens/${token}`).delete()),
    )
  }
}

/** New friend request → notify the receiver. */
export const notifyFriendRequest = functions.firestore.onDocumentCreated(
  'friendRequests/{requestId}',
  async (event) => {
    const snap = event.data
    if (!snap) return
    const data = snap.data()
    if (data.status !== 'pending') return
    const senderId = data.senderId as string
    const receiverId = data.receiverId as string
    if (typeof senderId !== 'string' || typeof receiverId !== 'string') return
    if (!(await notificationsEnabled(receiverId, 'requests'))) return
    if (await blockedBetween(senderId, receiverId)) return

    const username = await readUsername(senderId)
    await sendPush(receiverId, {
      type: 'request',
      actorId: senderId,
      username,
      title: 'New friend request',
      body: `${username} sent you a friend request`,
    })
  },
)

/** Friendship accepted → notify both members. */
export const notifyFriendshipAccepted = functions.firestore.onDocumentCreated(
  'friendships/{friendshipId}',
  async (event) => {
    const snap = event.data
    if (!snap) return
    const members = snap.data().members as string[] | undefined
    if (!Array.isArray(members) || members.length !== 2) return

    for (const member of members) {
      if (!(await notificationsEnabled(member, 'requests'))) continue
      const other = members.find((m) => m !== member)!
      const username = await readUsername(other)
      await sendPush(member, {
        type: 'accepted',
        actorId: other,
        username,
        title: 'You’re connected',
        body: `You and ${username} are now connected`,
      })
    }
  },
)

/** New message → notify the other member (generic text, no content). */
export const notifyMessageCreated = functions.firestore.onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const snap = event.data
    if (!snap) return
    const conversationId = event.params.conversationId as string
    const senderId = snap.data().senderId as string
    if (typeof senderId !== 'string') return

    const convSnap = await db.doc(`conversations/${conversationId}`).get()
    const members = convSnap.data()?.members as string[] | undefined
    if (!Array.isArray(members) || members.length !== 2) return
    const recipient = members.find((m) => m !== senderId)
    if (!recipient) return
    if (!(await notificationsEnabled(recipient, 'messages'))) return
    if (await blockedBetween(senderId, recipient)) return

    const username = await readUsername(senderId)
    await sendPush(recipient, {
      type: 'message',
      actorId: senderId,
      username,
      title: 'New message',
      body: `New message from ${username}`,
      conversationId,
    })
  },
)
