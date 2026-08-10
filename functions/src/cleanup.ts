/**
 * Scheduled content cleanup — the authoritative expiry layer (2 of 3).
 * Client-side filtering and Firestore TTL are the other layers.
 *
 * Runs hourly and is fully idempotent:
 *   • deletes expired messages + their Storage media
 *   • deletes expired statuses + views + their Storage media
 *   • clears expired `ephemeralLastMessage` previews from conversations
 *   • best-effort sweep of orphan media (Storage files with no live doc)
 *
 * Batched, respects per-run caps so a run never exceeds budget, and logs only
 * counts + document IDs — never message bodies (privacy §5).
 */
import { db, functions, storage, FieldValue, Timestamp } from './shared'

const PAGE_SIZE = 200
const ORPHAN_SWEEP_CAP = 500

/** Delete a Storage file if present (already-gone is fine — idempotent). */
async function deleteStorageFile(path: string | undefined): Promise<void> {
  if (!path) return
  try {
    await storage.bucket().file(path).delete()
  } catch {
    // already deleted
  }
}

/** Delete every document in a (sub)collection, in batches. */
async function deleteAll(
  ref: FirebaseFirestore.CollectionReference,
  batchSize = 100,
): Promise<number> {
  let total = 0
  for (;;) {
    const snap = await ref.limit(batchSize).get()
    if (snap.empty) return total
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    total += snap.size
  }
}

/** Expire messages whose expiresAt has passed, deleting their media too. */
async function expireMessages(now: FirebaseFirestore.Timestamp): Promise<number> {
  let count = 0
  for (;;) {
    const snap = await db
      .collectionGroup('messages')
      .where('expiresAt', '<=', now)
      .limit(PAGE_SIZE)
      .get()
    if (snap.empty) break

    // Remove media first so no orphan files are left if the doc delete wins.
    await Promise.all(snap.docs.map((d) => deleteStorageFile(d.data()?.mediaPath as string | undefined)))

    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    count += snap.size
  }
  return count
}

/** Expire statuses (views + media + doc). */
async function expireStatuses(now: FirebaseFirestore.Timestamp): Promise<number> {
  let count = 0
  for (;;) {
    const snap = await db
      .collection('statuses')
      .where('expiresAt', '<=', now)
      .limit(PAGE_SIZE)
      .get()
    if (snap.empty) break

    for (const d of snap.docs) {
      const data = d.data()
      // Delete the views subcollection before the parent doc.
      await deleteAll(db.collection(`statuses/${d.id}/views`))
      await deleteStorageFile(data?.mediaPath as string | undefined)
      await d.ref.delete()
      count++
    }
  }
  return count
}

/** Clear ephemeralLastMessage previews whose source message has expired. */
async function expirePreviews(now: FirebaseFirestore.Timestamp): Promise<number> {
  let count = 0
  for (;;) {
    const snap = await db
      .collection('conversations')
      .where('ephemeralLastMessage.expiresAt', '<=', now)
      .limit(PAGE_SIZE)
      .get()
    if (snap.empty) break

    const batch = db.batch()
    snap.docs.forEach((d) => batch.update(d.ref, { ephemeralLastMessage: FieldValue.delete() }))
    await batch.commit()
    count += snap.size
  }
  return count
}

/** Delete Storage files whose owning message/status doc no longer exists. */
async function sweepOrphanMedia(): Promise<number> {
  let removed = 0
  const bucket = storage.bucket()

  // chatMedia/{conversationId}/{messageId}/{filename}
  const [chatFiles] = await bucket.getFiles({ prefix: 'chatMedia/', maxResults: ORPHAN_SWEEP_CAP })
  for (const file of chatFiles) {
    const parts = file.name.split('/')
    if (parts.length < 4) continue
    const [, conversationId, messageId] = parts
    const docSnap = await db.doc(`conversations/${conversationId}/messages/${messageId}`).get()
    if (docSnap.exists) continue
    try {
      await file.delete()
      removed++
    } catch {
      // raced — someone else removed it
    }
  }

  // statusMedia/{userId}/{statusId}/{filename}
  const [statusFiles] = await bucket.getFiles({
    prefix: 'statusMedia/',
    maxResults: ORPHAN_SWEEP_CAP,
  })
  for (const file of statusFiles) {
    const parts = file.name.split('/')
    if (parts.length < 4) continue
    const [, , statusId] = parts
    const docSnap = await db.doc(`statuses/${statusId}`).get()
    if (docSnap.exists) continue
    try {
      await file.delete()
      removed++
    } catch {
      // raced
    }
  }

  return removed
}

/**
 * Hourly privacy sweep. Logs only counts and doc ids, never content.
 * TTL on `expiresAt` (Firestore console) is layer 3 for hard guarantees.
 */
export const cleanupExpiredContent = functions.scheduler.onSchedule(
  'every 1 hour',
  async () => {
    const now = Timestamp.now()
    const messages = await expireMessages(now)
    const statuses = await expireStatuses(now)
    const previews = await expirePreviews(now)
    const orphanMedia = await sweepOrphanMedia()

    console.log(
      `[cleanup] expired: ${messages} messages, ${statuses} statuses, ` +
        `${previews} previews; orphan media removed: ${orphanMedia}`,
    )
  },
)
