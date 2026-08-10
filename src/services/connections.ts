/**
 * Connection operations: friend request lifecycle. All mutations go through
 * Cloud Functions so the server can atomically validate blocking/duplicates.
 */
'use client'

import { callFunction } from '@/lib/callable'

/** Send a friend request to a user by uid. */
export function sendFriendRequest(receiverId: string): Promise<{ requestId: string }> {
  return callFunction('sendFriendRequest', { receiverId })
}

/** Accept an incoming request → creates friendship + conversation. */
export function acceptFriendRequest(requestId: string): Promise<{ conversationId: string }> {
  return callFunction('acceptFriendRequest', { requestId })
}

/** Cancel an outgoing pending request (sender only). */
export function cancelFriendRequest(requestId: string): Promise<unknown> {
  return callFunction('cancelFriendRequest', { requestId })
}

/** Reject an incoming pending request (receiver only). */
export function rejectFriendRequest(requestId: string): Promise<unknown> {
  return callFunction('rejectFriendRequest', { requestId })
}
