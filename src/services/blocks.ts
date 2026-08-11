/**
 * Block operations. Both go through Cloud Functions so the server can run the
 * relationship cascade (reject pending requests, delete friendship + chat)
 * and because the rules forbid client-side block-doc deletion.
 */
'use client'

import { callFunction } from '@/lib/callable'

/** Block a user: severs the connection and removes the existing chat. */
export function blockUser(targetId: string): Promise<{ ok: true }> {
  return callFunction<{ targetId: string }, { ok: true }>('blockUser', { targetId })
}

/** Unblock a user (only removes the caller's own block). */
export function unblockUser(targetId: string): Promise<{ ok: true }> {
  return callFunction<{ targetId: string }, { ok: true }>('unblockUser', { targetId })
}
