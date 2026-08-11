/**
 * Block management functions.
 *
 * Blocking severs a connection server-side: the block doc at
 * blocks/{blockerId}_{blockedId} gates every rule (messages, requests,
 * statuses) via blockedBetween. The cascade below also rejects any pending
 * friend request and removes the friendship + conversation so neither party
 * retains access to the prior chat — the relationship must be rebuilt from
 * scratch after an unblock.
 */
import { callableOptions, db, fail, functions, pairKey, requireVerified, Timestamp, storage } from './shared'

interface TargetPayload {
  targetId?: string
}

/** Delete a 1:1 conversation: message docs (and their media) then the doc. */
async function deleteConversation(key: string): Promise<void> {
  const messagesRef = db.collection(`conversations/${key}/messages`)
  for (let batch = db.batch(); ; batch = db.batch()) {
    const snap = await messagesRef.limit(500).get()
    if (snap.empty) break
    for (const doc of snap.docs) {
      const data = doc.data()
      if (typeof data.mediaPath === 'string') {
        storage.bucket().file(data.mediaPath).delete().catch(() => undefined)
      }
      batch.delete(doc.ref)
    }
    await batch.commit()
    if (snap.docs.length < 500) break
  }
  await db.doc(`conversations/${key}`).delete()
}

/**
 * Block a user. Idempotent: re-blocking an already-blocked user is a no-op on
 * the block doc but still runs the cascade (harmless).
 */
export const blockUser = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireVerified(request)
    const targetId = (request.data as TargetPayload | undefined)?.targetId?.trim() ?? ''
    if (!targetId) fail('invalid-argument', 'Missing user to block')
    if (targetId === uid) fail('invalid-argument', 'You cannot block yourself')

    const now = Timestamp.now()
    const blockRef = db.doc(`blocks/${uid}_${targetId}`)

    // Idempotent block doc. The client rules also permit direct creation, but
    // the relationship cascade below must run server-side.
    const existing = await blockRef.get()
    if (!existing.exists) {
      await blockRef.set({ blockerId: uid, blockedId: targetId, createdAt: now })
    }

    // Cancel any pending request in either direction.
    const pendingRefs = [
      db.doc(`friendRequests/${uid}_${targetId}`),
      db.doc(`friendRequests/${targetId}_${uid}`),
    ]
    await Promise.all(
      pendingRefs.map(async (ref) => {
        const snap = await ref.get()
        if (snap.exists && snap.data()?.status === 'pending') {
          await ref.update({ status: 'rejected', updatedAt: now })
        }
      }),
    )

    // Sever the relationship and the chat (removes both parties' access).
    const key = pairKey(uid, targetId)
    const [friendship, conversation] = await Promise.all([
      db.doc(`friendships/${key}`).get(),
      db.doc(`conversations/${key}`).get(),
    ])
    if (friendship.exists) await db.doc(`friendships/${key}`).delete()
    if (conversation.exists) await deleteConversation(key)

    return { ok: true }
  },
)

/** Unblock a user. Only removes the caller's own block doc. */
export const unblockUser = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireVerified(request)
    const targetId = (request.data as TargetPayload | undefined)?.targetId?.trim() ?? ''
    if (!targetId) fail('invalid-argument', 'Missing user to unblock')

    const blockRef = db.doc(`blocks/${uid}_${targetId}`)
    const snap = await blockRef.get()
    if (snap.exists) await blockRef.delete()

    return { ok: true }
  },
)
