/**
 * Public profile search. Prefix query on normalizedUsername so "ale" matches
 * alex, alexa, alessandro — case/format insensitive. Uses the single-field
 * automatic index (orderBy + startAt/endAt range, no composite needed).
 */
'use client'

import { collection, endAt, getDocs, limit, orderBy, query, startAt } from 'firebase/firestore'
import { getFirestoreDb } from '@/lib/firebase/client'
import { normalizeUsername } from '@/lib/validation'
import { SEARCH_RESULT_LIMIT } from '@/lib/constants'
import type { PublicProfile } from '@/types'

/** Search public profiles by username prefix, excluding the current user. */
export async function searchUsers(prefix: string, excludeUid: string): Promise<PublicProfile[]> {
  const db = getFirestoreDb()
  const normalized = normalizeUsername(prefix)
  if (normalized.length === 0) return []

  // orderBy + startAt/endAt gives the prefix range on a single field.
  const q = query(
    collection(db, 'publicProfiles'),
    orderBy('normalizedUsername'),
    startAt(normalized),
    endAt(normalized + '~'),
    limit(SEARCH_RESULT_LIMIT),
  )

  const snap = await getDocs(q)
  const results: PublicProfile[] = []
  snap.forEach((doc) => {
    const data = doc.data() as PublicProfile
    if (data.uid !== excludeUid) results.push(data)
  })
  return results
}
