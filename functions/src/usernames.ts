/**
 * Username reservation + change functions.
 *
 * Global uniqueness is guaranteed by a Firestore transaction on
 * usernames/{normalizedUsername} — two clients can never claim the same
 * normalized name (the transaction serializes the read-then-write).
 */
import {
  callableOptions,
  db,
  fail,
  functions,
  normalizeUsername,
  requireAuth,
  Timestamp,
  USERNAME_PATTERN,
} from './shared'

const RESERVED = new Set([
  'admin', 'administrator', 'a3chat', 'support', 'help', 'moderator',
  'system', 'root', 'a3', 'api', 'firebase', 'status', 'settings',
  'login', 'register', 'search', 'profile', 'home', 'notification',
])

interface ReservePayload {
  username?: string
}

/**
 * Atomically claim a username for the caller and create (or finalize) their
 * account documents. Idempotent: safe to call again after verification.
 */
export const reserveUsername = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireAuth(request)
    const payload = request.data as ReservePayload | undefined
    const raw = payload?.username?.trim() ?? ''
    const normalized = normalizeUsername(raw)

    if (!USERNAME_PATTERN.test(normalized)) {
      fail('invalid-argument', 'Invalid username')
    }
    if (RESERVED.has(normalized)) {
      fail('invalid-argument', 'That username is reserved')
    }

    const usernameRef = db.doc(`usernames/${normalized}`)
    const userRef = db.doc(`users/${uid}`)
    const profileRef = db.doc(`publicProfiles/${uid}`)

    const email = request.auth?.token?.email ?? ''
    const now = Timestamp.now()
    const emailVerified = request.auth?.token?.email_verified === true

    await db.runTransaction(async (tx) => {
      const usernameSnap = await tx.get(usernameRef)
      if (usernameSnap.exists) {
        const owner = usernameSnap.data()?.uid
        if (owner === uid) {
          // Already reserved by this user — finalize and return (idempotent).
          if (emailVerified) {
            tx.update(userRef, { emailVerified: true, updatedAt: now })
          }
          return
        }
        fail('already-exists', 'That username is already taken')
      }

      tx.set(usernameRef, { uid, createdAt: now })
      tx.set(
        userRef,
        {
          uid,
          email,
          username: raw,
          normalizedUsername: normalized,
          createdAt: now,
          updatedAt: now,
          emailVerified,
        },
        { merge: true },
      )
      tx.set(
        profileRef,
        {
          uid,
          username: raw,
          normalizedUsername: normalized,
          displayName: raw,
          createdAt: now,
        },
        { merge: true },
      )
    })

    return { username: raw, normalizedUsername: normalized }
  },
)

/**
 * Change the caller's username atomically: swap the reservation and update
 * both account documents in one transaction.
 */
export const changeUsername = functions.https.onCall(
  callableOptions,
  async (request) => {
    const uid = requireAuth(request)
    const payload = request.data as ReservePayload | undefined
    const raw = payload?.username?.trim() ?? ''
    const normalized = normalizeUsername(raw)

    if (!USERNAME_PATTERN.test(normalized)) fail('invalid-argument', 'Invalid username')
    if (RESERVED.has(normalized)) fail('invalid-argument', 'That username is reserved')

    const userRef = db.doc(`users/${uid}`)
    const oldSnap = await userRef.get()
    if (!oldSnap.exists) fail('failed-precondition', 'Account not fully set up')
    const oldNormalized: string = oldSnap.data()?.normalizedUsername ?? ''

    const newRef = db.doc(`usernames/${normalized}`)
    const oldUsernameRef = oldNormalized ? db.doc(`usernames/${oldNormalized}`) : null
    const profileRef = db.doc(`publicProfiles/${uid}`)
    const now = Timestamp.now()

    await db.runTransaction(async (tx) => {
      if (normalized === oldNormalized) return
      const target = await tx.get(newRef)
      if (target.exists) fail('already-exists', 'That username is already taken')

      tx.set(newRef, { uid, createdAt: now })
      if (oldUsernameRef) tx.delete(oldUsernameRef)
      tx.update(userRef, { username: raw, normalizedUsername: normalized, updatedAt: now })
      tx.update(profileRef, { username: raw, normalizedUsername: normalized })
    })

    return { username: raw, normalizedUsername: normalized }
  },
)
