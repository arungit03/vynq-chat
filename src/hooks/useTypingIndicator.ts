'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { setTyping, clearTyping } from '@/services/typing'
import { TYPING_WRITE_THROTTLE_MS } from '@/lib/constants'

/**
 * Throttled typing writes. Call `notifyTyping()` when the user is actively
 * typing; writes happen at most every `TYPING_WRITE_THROTTLE_MS` and stop
 * when the user stops (unmount or explicit clear).
 */
export function useTypingIndicator(conversationId: string | null) {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const lastWrite = useRef(0)
  const active = useRef(false)

  const notifyTyping = () => {
    if (!conversationId || !uid) return
    const now = Date.now()
    active.current = true
    if (now - lastWrite.current >= TYPING_WRITE_THROTTLE_MS) {
      lastWrite.current = now
      setTyping(conversationId, uid).catch(() => undefined)
    }
  }

  useEffect(() => {
    return () => {
      if (active.current && conversationId && uid) {
        clearTyping(conversationId, uid).catch(() => undefined)
      }
    }
  }, [conversationId, uid])

  return { notifyTyping }
}
