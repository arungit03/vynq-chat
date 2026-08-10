/**
 * A3Chat Cloud Functions — entry point.
 *
 * Functions are organized by domain (usernames, connections, cleanup,
 * notifications, accounts) and exported here for the Functions framework.
 */
import { functions, requireVerified, callableOptions } from './shared'

/**
 * Lightweight health check used by tests/emulator to confirm functions load.
 */
export const ping = functions.https.onCall(callableOptions, (request) => {
  const uid = requireVerified(request)
  return { ok: true, uid }
})

// ── Usernames ────────────────────────────────────────────────
export { reserveUsername, changeUsername } from './usernames'

// ── Connections ──────────────────────────────────────────────
export {
  sendFriendRequest,
  acceptFriendRequest,
  cancelFriendRequest,
  rejectFriendRequest,
} from './connections'
