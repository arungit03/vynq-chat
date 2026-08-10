/**
 * Global auth provider.
 *
 * Exposes the Firebase Auth user, the auth boot status, email-verified state,
 * and the user's public profile (subscribed for realtime updates). The
 * (auth) and (app) route groups use this to gate access.
 */
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirebaseAuth, getFirestoreDb } from '@/lib/firebase/client'
import { reloadUser } from '@/services/auth'
import type { PublicProfile } from '@/types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: User | null
  status: AuthStatus
  emailVerified: boolean
  profile: PublicProfile | null
  profileReady: boolean
  refreshAuth: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [profileUid, setProfileUid] = useState<string | null>(null)
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [profileReady, setProfileReady] = useState(false)

  // Auth state
  useEffect(() => {
    const auth = getFirebaseAuth()
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setStatus(next ? 'authenticated' : 'unauthenticated')
    })
    return unsubscribe
  }, [])

  // Reset profile state the moment the signed-in user changes. Performed
  // during render (the React-recommended adjustment pattern), not in an effect.
  const currentUid = user?.uid ?? null
  if (profileUid !== currentUid) {
    setProfileUid(currentUid)
    setProfile(null)
    setProfileReady(false)
  }

  // Public profile subscription (kept in sync so avatars/names update live)
  useEffect(() => {
    if (!user) return
    const db = getFirestoreDb()
    const ref = doc(db, 'publicProfiles', user.uid)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as PublicProfile) : null)
        setProfileReady(true)
      },
      () => {
        setProfile(null)
        setProfileReady(true)
      },
    )
    return unsubscribe
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAuth = useCallback(async () => {
    const current = getFirebaseAuth().currentUser
    if (!current) return null
    const refreshed = await reloadUser(current)
    setUser({ ...current } as User)
    return refreshed
  }, [])

  const emailVerified = user?.emailVerified ?? false

  const value = useMemo(
    () => ({ user, status, emailVerified, profile, profileReady, refreshAuth }),
    [user, status, emailVerified, profile, profileReady, refreshAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
