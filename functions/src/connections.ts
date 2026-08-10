/**
 * Connection functions: friend requests and friendship creation.
 *
 * All mutations are server-side so we can validate blocking, duplicates and
 * existing relationships atomically. Client rules only allow reads.
 */
import {
  callableOptions,
  db,
  fail,
  functions,
  pairKey,
  requireVerified,
  Timestamp,
} from './shared'

interface TargetPayload {
  receiverId?: string
}

interface RequestPayload {
  requestId?: string
}

/**
 * Send a friend request. Deterministic doc id = senderId_receiverId so a
 * duplicate send is idempotent and can never create two requests.
 */
export const sendFriendRequest = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireVerified(request)
    const receiverId = (request.data as TargetPayload | undefined)?.receiverId?.trim() ?? ''

    if (!receiverId) fail('invalid-argument', 'Missing receiver')
    if (receiverId === uid) fail('invalid-argument', 'You cannot add yourself')

    const now = Timestamp.now()
    const requestId = `${uid}_${receiverId}`
    const requestRef = db.doc(`friendRequests/${requestId}`)
    const reverseRef = db.doc(`friendRequests/${receiverId}_${uid}`)
    const receiverProfile = db.doc(`publicProfiles/${receiverId}`)

    await db.runTransaction(async (tx) => {
      const profileSnap = await tx.get(receiverProfile)
      if (!profileSnap.exists) fail('not-found', 'That user was not found')

      const existing = await tx.get(requestRef)
      if (existing.exists) {
        const status = existing.data()?.status
        if (status === 'pending') return // idempotent resend
        if (status === 'accepted') fail('already-exists', 'You are already connected')
        // rejected/cancelled — allow a fresh request by overwriting.
      }

      const reverse = await tx.get(reverseRef)
      if (reverse.exists && reverse.data()?.status === 'pending') {
        fail('already-exists', 'They already sent you a request — check your requests')
      }

      // Blocking is symmetric: reject if either side blocked the other.
      const blockRef = db.doc(`blocks/${uid}_${receiverId}`)
      const reverseBlockRef = db.doc(`blocks/${receiverId}_${uid}`)
      const [blocked, reverseBlocked] = await Promise.all([
        tx.get(blockRef),
        tx.get(reverseBlockRef),
      ])
      if (blocked.exists || reverseBlocked.exists) {
        fail('permission-denied', 'You cannot send a request to this user')
      }

      tx.set(requestRef, {
        senderId: uid,
        receiverId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
    })

    return { requestId }
  },
)

/**
 * Accept a friend request: creates the friendship and the deterministic
 * 1:1 conversation in the same transaction as the status flip, so the pair
 * can never end up connected-but-without-a-chat (or vice versa).
 */
export const acceptFriendRequest = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireVerified(request)
    const requestId = (request.data as RequestPayload | undefined)?.requestId?.trim() ?? ''
    if (!requestId) fail('invalid-argument', 'Missing request')

    const requestRef = db.doc(`friendRequests/${requestId}`)
    const now = Timestamp.now()

    let conversationId = ''

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef)
      if (!snap.exists) fail('not-found', 'Request not found')
      const data = snap.data()!
      if (data.receiverId !== uid) fail('permission-denied', 'Not your request')
      if (data.status !== 'pending') fail('failed-precondition', 'Request is no longer pending')

      const senderId = data.senderId as string
      const key = pairKey(uid, senderId)
      const friendshipRef = db.doc(`friendships/${key}`)
      const conversationRef = db.doc(`conversations/${key}`)

      tx.update(requestRef, { status: 'accepted', updatedAt: now })
      tx.set(friendshipRef, { members: [senderId, uid], createdAt: now })

      const conversationData = {
        members: [senderId, uid],
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        lastRead: { [senderId]: now, [uid]: now },
      }
      tx.set(conversationRef, conversationData, { merge: true })
      conversationId = key
    })

    return { conversationId }
  },
)

/**
 * Cancel an outgoing pending request. Only the sender may cancel.
 */
export const cancelFriendRequest = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireVerified(request)
    const requestId = (request.data as RequestPayload | undefined)?.requestId?.trim() ?? ''
    if (!requestId) fail('invalid-argument', 'Missing request')

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.doc(`friendRequests/${requestId}`))
      if (!snap.exists) return // already gone — idempotent
      const data = snap.data()!
      if (data.senderId !== uid) fail('permission-denied', 'Not your request')
      if (data.status !== 'pending') fail('failed-precondition', 'Request is no longer pending')
      tx.update(db.doc(`friendRequests/${requestId}`), { status: 'cancelled', updatedAt: Timestamp.now() })
    })
  },
)

/**
 * Reject an incoming pending request. Only the receiver may reject.
 */
export const rejectFriendRequest = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireVerified(request)
    const requestId = (request.data as RequestPayload | undefined)?.requestId?.trim() ?? ''
    if (!requestId) fail('invalid-argument', 'Missing request')

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.doc(`friendRequests/${requestId}`))
      if (!snap.exists) return // already gone — idempotent
      const data = snap.data()!
      if (data.receiverId !== uid) fail('permission-denied', 'Not your request')
      if (data.status !== 'pending') fail('failed-precondition', 'Request is no longer pending')
      tx.update(db.doc(`friendRequests/${requestId}`), { status: 'rejected', updatedAt: Timestamp.now() })
    })
  },
)
