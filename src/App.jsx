import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyActionCode,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore'
import { auth, authReady, db } from './firebase'
import './App.css'

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/
const MIN_PASSWORD_LENGTH = 6
const MAX_PASSWORD_LENGTH = 128
const MAX_BIO_LENGTH = 180
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_STATUS_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_EMBEDDED_IMAGE_CHARS = 320000
const STATUS_EXPIRY_MS = 24 * 60 * 60 * 1000
const STATUS_VIEW_MS = 15 * 1000
const HIDDEN_CHAT_USERNAMES = new Set(['vivek'])

const normalizeUsername = (value) => value.trim().toLowerCase()
const buildPairKey = (uidA, uidB) => [uidA, uidB].sort().join('_')

const toMillis = (timestamp) => {
  if (!timestamp) return 0
  if (typeof timestamp === 'number') return timestamp
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000
  return 0
}

const formatMessageTime = (timestamp) => {
  const millis = toMillis(timestamp)
  if (!millis) return ''
  const value = new Date(millis)
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

const formatStatusTime = (timestamp) => {
  const millis = toMillis(timestamp)
  if (!millis) return 'just now'
  const value = new Date(millis)
  return value.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const validateUsername = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return 'Username is required.'
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'Username must be 3-20 chars with letters, numbers, or underscore.'
  }
  return ''
}

const validateSignupPassword = (value) => {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }

  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or less.`
  }

  return ''
}

const stripEmailActionParamsFromUrl = () => {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  ;['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl'].forEach((key) => {
    url.searchParams.delete(key)
  })

  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, document.title, nextUrl || '/')
}

const markEmailVerifiedInDb = async (user) => {
  if (!user?.uid) return

  await setDoc(
    doc(db, 'users', user.uid),
    {
      emailVerified: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

const getFriendlyError = (code) => {
  const map = {
    'auth/email-already-in-use': 'Email already in use. Try logging in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/missing-email': 'Enter your email address first.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-login-credentials': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/user-disabled': 'This account is disabled.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/missing-password': 'Enter your password first.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection and retry.',
    'auth/operation-not-allowed': 'Enable Email/Password in Firebase Authentication settings.',
    'auth/configuration-not-found': 'Firebase Authentication is not configured correctly.',
    'auth/requires-recent-login': 'Session is too old. Sign in again and retry.',
    'auth/invalid-action-code': 'Verification link is invalid.',
    'auth/expired-action-code': 'Verification link expired. Request a new one.',
    'auth/invalid-continue-uri': 'Reset link configuration is invalid.',
    'auth/missing-continue-uri': 'Reset link configuration is missing.',
    'auth/unauthorized-continue-uri': 'Reset link domain is not authorized in Firebase.',
    'auth/unauthorized-domain': 'Current domain is not authorized in Firebase Authentication.',
    'auth/internal-error': 'Firebase Authentication failed unexpectedly. Retry once.',
    'auth/user-token-expired': 'Session expired. Sign in again and retry.',
    'permission-denied': 'Request blocked by Firestore rules. Publish your rules and retry.',
    aborted: 'Operation conflict. Retry once.',
    'failed-precondition': 'Firestore index may be required. Check console and create it.',
    'storage/unauthorized': 'Storage permission denied. Publish Storage rules and retry.',
    'storage/canceled': 'Upload canceled.',
    'storage/retry-limit-exceeded': 'Upload timeout. Check network and retry.',
    'storage/quota-exceeded': 'Storage quota exceeded. Increase Firebase Storage quota.',
    'storage/unknown': 'Storage upload failed. Check Firebase Storage configuration.',
    'storage/bucket-not-found': 'Storage bucket not found. Check Firebase storage bucket config.',
    'storage/project-not-found': 'Firebase project not found for Storage.',
    'storage/invalid-default-bucket': 'Invalid Storage bucket config.',
    'storage/upload-failed-all-buckets': 'All configured Storage buckets failed. Check bucket name and publish Storage rules.',
    image_read_failed: 'Could not read image file. Try another image.',
    image_decode_failed: 'Could not process image file. Try another image.',
    image_canvas_failed: 'Browser image processing failed. Reload and retry.',
    image_too_large_for_firestore: 'Image is too large. Choose a smaller image.',
  }

  return map[code] || 'Something went wrong. Please try again.'
}

const getFriendlyErrorWithCode = (error) => {
  const code = error?.code
  const message = getFriendlyError(code)
  return code ? `${message} (${code})` : message
}

const convertImageFileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('image_read_failed'))
    reader.onload = () => {
      const sourceDataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!sourceDataUrl) {
        reject(new Error('image_read_failed'))
        return
      }

      const img = new Image()
      img.onerror = () => reject(new Error('image_decode_failed'))
      img.onload = () => {
        const maxSide = 720
        const longestSide = Math.max(img.width, img.height) || 1
        const scale = Math.min(1, maxSide / longestSide)
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('image_canvas_failed'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        let quality = 0.82
        let output = canvas.toDataURL('image/jpeg', quality)
        while (output.length > MAX_EMBEDDED_IMAGE_CHARS && quality > 0.45) {
          quality -= 0.08
          output = canvas.toDataURL('image/jpeg', quality)
        }

        if (output.length > MAX_EMBEDDED_IMAGE_CHARS) {
          reject(new Error('image_too_large_for_firestore'))
          return
        }

        resolve(output)
      }

      img.src = sourceDataUrl
    }

    reader.readAsDataURL(file)
  })

const getActionCodeSettings = () => {
  if (typeof window === 'undefined') return null
  const origin = window.location?.origin
  if (!origin || origin === 'null') return null

  return {
    url: origin,
    handleCodeInApp: false,
  }
}

const sendVerificationLink = async (user) => {
  const actionCodeSettings = getActionCodeSettings()

  if (actionCodeSettings) {
    try {
      await sendEmailVerification(user, actionCodeSettings)
      return
    } catch {
      // Fall through and retry with Firebase defaults.
    }
  }

  await sendEmailVerification(user)
}

const sendPasswordResetLink = async (targetEmail) => {
  const normalizedEmail = targetEmail.trim().toLowerCase()
  await sendPasswordResetEmail(auth, normalizedEmail)
}

const rollbackCreatedAuthUser = async (user) => {
  if (!user) return true

  try {
    await deleteUser(user)
    return true
  } catch {
    try {
      await signOut(auth)
    } catch {
      // Ignore fallback cleanup failure.
    }
    return false
  }
}

function App() {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const usernameCheckRef = useRef(0)
  const profilePhotoInputRef = useRef(null)
  const statusPhotoInputRef = useRef(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)

  const [activePage, setActivePage] = useState('home')
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [isSendingRequest, setIsSendingRequest] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [incomingRequests, setIncomingRequests] = useState([])
  const [acceptedPairKeys, setAcceptedPairKeys] = useState([])
  const [requestActionBusyKey, setRequestActionBusyKey] = useState('')
  const [chats, setChats] = useState([])
  const [userCache, setUserCache] = useState({})
  const [activeChat, setActiveChat] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [draftMessage, setDraftMessage] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [deleteArmedMessageId, setDeleteArmedMessageId] = useState('')
  const [deletingMessageId, setDeletingMessageId] = useState('')
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [statuses, setStatuses] = useState([])
  const [isUploadingStatus, setIsUploadingStatus] = useState(false)
  const [statusViewerItem, setStatusViewerItem] = useState(null)

  const [profileUsername, setProfileUsername] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [draftProfileBio, setDraftProfileBio] = useState('')
  const [draftProfilePhotoUrl, setDraftProfilePhotoUrl] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false)
  const [isSendingPasswordLink, setIsSendingPasswordLink] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const searchParams = new URLSearchParams(window.location.search)
    const modeParam = searchParams.get('mode')
    const actionCode = searchParams.get('oobCode')

    if (modeParam !== 'verifyEmail' || !actionCode) return

    let cancelled = false

    const applyEmailVerificationLink = async () => {
      setError('')
      setNotice('Verifying email link...')
      setIsLoading(true)

      try {
        await applyActionCode(auth, actionCode)

        if (auth.currentUser) {
          await reload(auth.currentUser)
          const refreshedUser = auth.currentUser
          if (refreshedUser?.emailVerified) {
            await markEmailVerifiedInDb(refreshedUser)
            if (!cancelled) {
              setCurrentUser(refreshedUser)
              setNotice('Email verified. Entering first page.')
            }
          } else if (!cancelled) {
            setNotice('Email verified. Sign in to continue.')
          }
        } else if (!cancelled) {
          setNotice('Email verified. Sign in to continue.')
        }
      } catch (linkError) {
        if (!cancelled) setError(getFriendlyErrorWithCode(linkError))
      } finally {
        stripEmailActionParamsFromUrl()
        if (!cancelled) setIsLoading(false)
      }
    }

    applyEmailVerificationLink()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let unsubscribe = () => {}

    const init = async () => {
      await authReady
      if (!mounted) return

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!mounted) return
        setCurrentUser(user)
        setIsCheckingSession(false)
      })
    }

    init()

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!currentUser || currentUser.emailVerified) return undefined

    let cancelled = false

    const refreshVerificationState = async () => {
      try {
        await reload(currentUser)
        const refreshedUser = auth.currentUser
        if (!refreshedUser || cancelled || !refreshedUser.emailVerified) return

        await markEmailVerifiedInDb(refreshedUser)
        if (cancelled) return

        setCurrentUser(refreshedUser)
        setNotice('Email verified. Entering first page.')
      } catch {
        // Silent background check. Manual button still available.
      }
    }

    const intervalId = window.setInterval(refreshVerificationState, 5000)
    window.addEventListener('focus', refreshVerificationState)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVerificationState)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      setActivePage('home')
      setSearchUsername('')
      setSearchResult(null)
      setShowRequests(false)
      setIncomingRequests([])
      setAcceptedPairKeys([])
      setChats([])
      setUserCache({})
      setActiveChat(null)
      setChatMessages([])
      setDraftMessage('')
      setStatuses([])
      setIsUploadingStatus(false)
      setStatusViewerItem(null)
      setIsEditingProfile(false)
      setIsSavingProfile(false)
      setIsUploadingProfilePhoto(false)
      setProfileUsername('')
      setProfileBio('')
      setProfilePhotoUrl('')
      setDraftProfileBio('')
      setDraftProfilePhotoUrl('')
      return undefined
    }

    let cancelled = false

    const loadProfile = async () => {
      try {
        const profileSnap = await getDoc(doc(db, 'users', currentUser.uid))
        if (cancelled) return

        if (!profileSnap.exists()) {
          const fallbackUsername = typeof currentUser.displayName === 'string' ? currentUser.displayName : ''
          setProfileUsername(fallbackUsername)
          setProfileBio('')
          setProfilePhotoUrl('')
          setDraftProfileBio('')
          setDraftProfilePhotoUrl('')
          return
        }

        const data = profileSnap.data()
        const nextUsername = typeof data.username === 'string' ? data.username : ''
        const nextBio = typeof data.bio === 'string' ? data.bio : ''
        const nextPhotoUrl = typeof data.profilePhotoUrl === 'string' ? data.profilePhotoUrl : ''

        setProfileUsername(nextUsername)
        setProfileBio(nextBio)
        setProfilePhotoUrl(nextPhotoUrl)
        setDraftProfileBio(nextBio)
        setDraftProfilePhotoUrl(nextPhotoUrl)
      } catch {
        if (cancelled) return
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified) {
      setIncomingRequests([])
      return undefined
    }

    const requestsQuery = query(
      collection(db, 'requests'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'pending'),
    )

    return onSnapshot(
      requestsQuery,
      (snapshot) => {
        const nextRequests = snapshot.docs
          .map((snapshotDoc) => ({
            pairKey: snapshotDoc.id,
            ...snapshotDoc.data(),
          }))
          .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))
        setIncomingRequests(nextRequests)
      },
      (snapshotError) => {
        setError(getFriendlyErrorWithCode(snapshotError))
      },
    )
  }, [currentUser?.emailVerified, currentUser?.uid])

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified) {
      setAcceptedPairKeys([])
      return undefined
    }

    let outgoingPairs = []
    let incomingPairs = []

    const syncAcceptedPairs = () => {
      const merged = Array.from(new Set([...outgoingPairs, ...incomingPairs]))
      setAcceptedPairKeys(merged)
    }

    const outgoingRequestsQuery = query(collection(db, 'requests'), where('fromUid', '==', currentUser.uid))
    const incomingRequestsQuery = query(collection(db, 'requests'), where('toUid', '==', currentUser.uid))

    const unsubscribeOutgoing = onSnapshot(
      outgoingRequestsQuery,
      (snapshot) => {
        outgoingPairs = snapshot.docs
          .filter((snapshotDoc) => snapshotDoc.data().status === 'accepted')
          .map((snapshotDoc) => snapshotDoc.id)
        syncAcceptedPairs()
      },
      (snapshotError) => {
        setError(getFriendlyErrorWithCode(snapshotError))
      },
    )

    const unsubscribeIncoming = onSnapshot(
      incomingRequestsQuery,
      (snapshot) => {
        incomingPairs = snapshot.docs
          .filter((snapshotDoc) => snapshotDoc.data().status === 'accepted')
          .map((snapshotDoc) => snapshotDoc.id)
        syncAcceptedPairs()
      },
      (snapshotError) => {
        setError(getFriendlyErrorWithCode(snapshotError))
      },
    )

    return () => {
      unsubscribeOutgoing()
      unsubscribeIncoming()
    }
  }, [currentUser?.emailVerified, currentUser?.uid])

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified) {
      setChats([])
      return undefined
    }

    const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid))

    return onSnapshot(
      chatsQuery,
      (snapshot) => {
        const nextChats = snapshot.docs.map((snapshotDoc) => ({
          pairKey: snapshotDoc.id,
          ...snapshotDoc.data(),
        }))
        setChats(nextChats)
      },
      (snapshotError) => {
        setError(getFriendlyErrorWithCode(snapshotError))
      },
    )
  }, [currentUser?.emailVerified, currentUser?.uid])

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified) {
      setStatuses([])
      return undefined
    }

    const statusesQuery = query(collection(db, 'statuses'), where('audienceUids', 'array-contains', currentUser.uid))

    return onSnapshot(
      statusesQuery,
      (snapshot) => {
        const nextStatuses = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data()
          return {
            statusId: snapshotDoc.id,
            ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : snapshotDoc.id,
            ownerUsername: typeof data.ownerUsername === 'string' ? data.ownerUsername : 'user',
            ownerProfilePhotoUrl: typeof data.ownerProfilePhotoUrl === 'string' ? data.ownerProfilePhotoUrl : '',
            imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
            createdAt: data.createdAt || null,
            expiresAtMs: typeof data.expiresAtMs === 'number' ? data.expiresAtMs : 0,
          }
        })
        setStatuses(nextStatuses)
      },
      (snapshotError) => {
        setError(getFriendlyErrorWithCode(snapshotError))
      },
    )
  }, [currentUser?.emailVerified, currentUser?.uid])

  const missingUserUids = useMemo(() => {
    if (!currentUser?.uid) return []

    const collected = new Set()

    for (const request of incomingRequests) {
      if (request.fromUid && request.fromUid !== currentUser.uid && !userCache[request.fromUid]) {
        collected.add(request.fromUid)
      }
    }

    for (const chat of chats) {
      const participants = Array.isArray(chat.participants) ? chat.participants : []
      const otherUid = participants.find((uid) => uid !== currentUser.uid)
      if (otherUid && !userCache[otherUid]) {
        collected.add(otherUid)
      }
    }

    return Array.from(collected)
  }, [chats, currentUser?.uid, incomingRequests, userCache])

  useEffect(() => {
    if (!missingUserUids.length) return undefined

    let cancelled = false

    const loadUsers = async () => {
      const fetchedEntries = await Promise.all(
        missingUserUids.map(async (uid) => {
          try {
            const userSnapshot = await getDoc(doc(db, 'users', uid))
            if (!userSnapshot.exists()) return [uid, null]

            const data = userSnapshot.data()
            return [
              uid,
              {
                username: typeof data.username === 'string' ? data.username : 'user',
                profilePhotoUrl: typeof data.profilePhotoUrl === 'string' ? data.profilePhotoUrl : '',
                email: typeof data.email === 'string' ? data.email : '',
              },
            ]
          } catch {
            return [uid, null]
          }
        }),
      )

      if (cancelled) return

      setUserCache((previous) => {
        const nextCache = { ...previous }
        for (const [uid, payload] of fetchedEntries) {
          if (!payload) continue
          nextCache[uid] = payload
        }
        return nextCache
      })
    }

    loadUsers()

    return () => {
      cancelled = true
    }
  }, [missingUserUids])

  useEffect(() => {
    if (!currentUser?.uid || !activeChat?.pairKey) {
      setChatMessages([])
      return undefined
    }

    const messagesQuery = query(collection(db, 'chats', activeChat.pairKey, 'messages'), orderBy('createdAt', 'asc'))

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
        }))
        setChatMessages(nextMessages)
      },
      (snapshotError) => {
        setError(getFriendlyErrorWithCode(snapshotError))
      },
    )
  }, [activeChat?.pairKey, currentUser?.uid])

  useEffect(() => {
    if (!currentUser?.uid || !activeChat?.pairKey || !chatMessages.length) return

    const unseenMessages = chatMessages.filter((message) => {
      if (message.senderUid === currentUser.uid) return false
      if (typeof message.seenBy !== 'object' || message.seenBy === null) return true
      return message.seenBy[currentUser.uid] !== true
    })

    if (!unseenMessages.length) return

    Promise.all(
      unseenMessages.map((message) =>
        updateDoc(doc(db, 'chats', activeChat.pairKey, 'messages', message.id), {
          [`seenBy.${currentUser.uid}`]: true,
        }).catch(() => null),
      ),
    ).catch(() => null)
  }, [activeChat?.pairKey, chatMessages, currentUser?.uid])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)')
    const updateTouchState = () => setIsTouchDevice(mediaQuery.matches)

    updateTouchState()
    mediaQuery.addEventListener('change', updateTouchState)
    return () => mediaQuery.removeEventListener('change', updateTouchState)
  }, [])

  useEffect(() => {
    setDeleteArmedMessageId('')
    setDeletingMessageId('')
  }, [activeChat?.pairKey])

  useEffect(() => {
    if (!statusViewerItem) return undefined

    const timeoutId = window.setTimeout(() => {
      setStatusViewerItem(null)
    }, STATUS_VIEW_MS)

    return () => window.clearTimeout(timeoutId)
  }, [statusViewerItem])

  const switchMode = (nextMode) => {
    if (isLoading) return
    setMode(nextMode)
    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')
    setUsernameStatus('idle')
  }

  const getUsernameStatusText = () => {
    if (usernameStatus === 'checking') return 'Checking username...'
    if (usernameStatus === 'available') return 'Username is available.'
    if (usernameStatus === 'taken') return 'Username already taken.'
    if (usernameStatus === 'invalid') return 'Use 3-20 letters, numbers, or underscore.'
    if (usernameStatus === 'error') return 'Could not check username right now.'
    return ''
  }

  const checkUsernameAvailability = useCallback(async (candidate, options = {}) => {
    const { guardStale = true } = options
    const usernameError = validateUsername(candidate)
    if (usernameError) {
      setUsernameStatus(candidate.trim() ? 'invalid' : 'idle')
      return false
    }

    const requestId = ++usernameCheckRef.current
    setUsernameStatus('checking')

    try {
      const usernameLower = normalizeUsername(candidate)
      const usernameRef = doc(db, 'usernames', usernameLower)
      const usernameSnap = await getDoc(usernameRef)
      if (guardStale && requestId !== usernameCheckRef.current) return null

      if (usernameSnap.exists()) {
        setUsernameStatus('taken')
        return false
      }

      setUsernameStatus('available')
      return true
    } catch {
      if (guardStale && requestId !== usernameCheckRef.current) return null
      setUsernameStatus('error')
      throw new Error('username_check_failed')
    }
  }, [])

  const handleUsernameBlur = async () => {
    if (mode !== 'signup') return

    const usernameError = validateUsername(username)
    if (usernameError) {
      setUsernameStatus(username.trim() ? 'invalid' : 'idle')
      return
    }

    try {
      await checkUsernameAvailability(username)
    } catch {
      setUsernameStatus('error')
    }
  }

  useEffect(() => {
    if (mode !== 'signup' || isLoading) return undefined

    const trimmed = username.trim()
    if (!trimmed) {
      usernameCheckRef.current += 1
      setUsernameStatus('idle')
      return undefined
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
      usernameCheckRef.current += 1
      setUsernameStatus('invalid')
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      checkUsernameAvailability(trimmed).catch(() => {})
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [checkUsernameAvailability, isLoading, mode, username])

  const resolvePairState = async (otherUid) => {
    if (!currentUser?.uid) return null

    const pairKey = buildPairKey(currentUser.uid, otherUid)
    const requestRef = doc(db, 'requests', pairKey)
    const chatRef = doc(db, 'chats', pairKey)

    const [requestSnap, chatSnap] = await Promise.all([getDoc(requestRef), getDoc(chatRef)])

    let relation = 'can_request'
    let requestData = null

    if (requestSnap.exists()) {
      requestData = {
        pairKey: requestSnap.id,
        ...requestSnap.data(),
      }

      if (requestData.status === 'pending') {
        relation = requestData.fromUid === currentUser.uid ? 'outgoing_pending' : 'incoming_pending'
      } else if (requestData.status === 'accepted' && chatSnap.exists()) {
        relation = 'chat_exists'
      }
    }

    return { pairKey, relation, requestData }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isLoading) return

    setError('')
    setNotice('')

    const cleanedEmail = email.trim().toLowerCase()

    if (!cleanedEmail) {
      setError('Email is required.')
      return
    }

    if (mode === 'signup') {
      const usernameError = validateUsername(username)
      if (usernameError) {
        setError(usernameError)
        return
      }

      const passwordError = validateSignupPassword(password)
      if (passwordError) {
        setError(passwordError)
        return
      }

      if (password !== confirmPassword) {
        setError('Confirm password does not match.')
        return
      }
    } else if (!password) {
      setError('Password is required.')
      return
    }

    setIsLoading(true)

    if (mode === 'signup') {
      let createdUser = null
      let attemptedUsernameLower = ''

      try {
        const usernameClean = username.trim()
        const usernameLower = normalizeUsername(usernameClean)
        attemptedUsernameLower = usernameLower

        const credential = await createUserWithEmailAndPassword(auth, cleanedEmail, password)
        createdUser = credential.user

        const usernameRef = doc(db, 'usernames', usernameLower)
        const userRef = doc(db, 'users', createdUser.uid)
        const batch = writeBatch(db)

        batch.set(usernameRef, {
          uid: createdUser.uid,
          username: usernameClean,
          usernameLower,
          createdAt: serverTimestamp(),
        })

        batch.set(userRef, {
          uid: createdUser.uid,
          username: usernameClean,
          usernameLower,
          email: createdUser.email || cleanedEmail,
          emailVerified: false,
          bio: '',
          profilePhotoUrl: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        await batch.commit()

        // Non-blocking profile sync to keep signup responsive.
        void updateProfile(createdUser, { displayName: usernameClean }).catch(() => null)

        setUsernameStatus('available')
        setNotice('Account created. Sending verification email...')
        setMode('login')
        setPassword('')
        setConfirmPassword('')

        const signupUid = createdUser.uid
        const targetEmail = createdUser.email || cleanedEmail

        // Send verification email in background so UI does not block.
        void sendVerificationLink(createdUser)
          .then(() => {
            if (auth.currentUser?.uid !== signupUid) return
            setNotice(`Verification link sent to ${targetEmail}. Confirm email link to enter first page.`)
          })
          .catch((verificationError) => {
            if (auth.currentUser?.uid !== signupUid) return

            const verificationCode = verificationError?.code
            const verificationMessage = verificationCode
              ? getFriendlyError(verificationCode)
              : 'Account created, but verification email could not be sent right now.'

            setNotice(
              `${verificationMessage} Use "Resend verification email" from the next screen.${
                verificationCode ? ` (${verificationCode})` : ''
              }`,
            )
          })
      } catch (submitError) {
        let normalizedError = submitError

        if (submitError?.code === 'permission-denied' && attemptedUsernameLower) {
          try {
            const usernameSnapshot = await getDoc(doc(db, 'usernames', attemptedUsernameLower))
            if (usernameSnapshot.exists() && usernameSnapshot.data()?.uid !== createdUser?.uid) {
              normalizedError = new Error('username_taken')
            }
          } catch {
            // Ignore secondary lookup failure.
          }
        }

        if (normalizedError?.message === 'username_taken') {
          const rollbackSucceeded = await rollbackCreatedAuthUser(createdUser)
          setUsernameStatus('taken')
          setError(
            rollbackSucceeded
              ? 'Username already taken. Choose another username.'
              : 'Username already taken. Account may still exist with this email. Try logging in or reset password.',
          )
        } else {
          const rollbackSucceeded = await rollbackCreatedAuthUser(createdUser)
          const friendlyMessage = getFriendlyErrorWithCode(normalizedError)
          setError(
            rollbackSucceeded
              ? friendlyMessage
              : `${friendlyMessage} Account may still exist with this email. Try logging in or reset password.`,
          )
        }
      } finally {
        setIsLoading(false)
      }

      return
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, cleanedEmail, password)

      if (credential.user.emailVerified) {
        await markEmailVerifiedInDb(credential.user)
      } else {
        setNotice('Email not verified yet. Open your email and confirm the link to enter first page.')
      }
    } catch (loginError) {
      setError(getFriendlyErrorWithCode(loginError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (isLoading) return

    const cleanedEmail = email.trim().toLowerCase()
    if (!cleanedEmail) {
      setError('Enter your email first to reset password.')
      return
    }

    setError('')
    setNotice('')
    setIsLoading(true)

    try {
      await sendPasswordResetLink(cleanedEmail)
      setNotice(`Password reset link sent to ${cleanedEmail}.`)
    } catch (resetError) {
      setError(getFriendlyErrorWithCode(resetError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearchSubmit = async (event) => {
    event.preventDefault()
    if (!currentUser?.uid || isSearchingUsers) return

    setError('')
    setNotice('')

    const candidate = searchUsername.trim()
    if (!candidate) {
      setSearchResult(null)
      return
    }

    const usernameValidationError = validateUsername(candidate)
    if (usernameValidationError) {
      setError(usernameValidationError)
      return
    }

    setIsSearchingUsers(true)

    try {
      const usernameLower = normalizeUsername(candidate)
      const usernameSnapshot = await getDoc(doc(db, 'usernames', usernameLower))

      if (!usernameSnapshot.exists()) {
        setSearchResult({
          type: 'not_found',
          query: candidate,
        })
        return
      }

      const usernameData = usernameSnapshot.data()
      const targetUid = usernameData.uid
      const targetUsername = typeof usernameData.username === 'string' ? usernameData.username : candidate

      if (targetUid === currentUser.uid) {
        setSearchResult({
          type: 'self',
          username: targetUsername,
        })
        return
      }

      const pairState = await resolvePairState(targetUid)
      if (!pairState) return

      setSearchResult({
        type: 'user',
        uid: targetUid,
        username: targetUsername,
        pairKey: pairState.pairKey,
        relation: pairState.relation,
        requestData: pairState.requestData,
      })
    } catch (searchError) {
      setError(getFriendlyErrorWithCode(searchError))
    } finally {
      setIsSearchingUsers(false)
    }
  }

  const handleSendRequest = async () => {
    if (!currentUser?.uid || !searchResult || searchResult.type !== 'user' || isSendingRequest) return
    if (searchResult.relation !== 'can_request') return

    setIsSendingRequest(true)
    setError('')
    setNotice('')

    try {
      const fromUsername = profileUsername || currentUser.displayName || 'user'
      const pairKey = buildPairKey(currentUser.uid, searchResult.uid)
      const requestRef = doc(db, 'requests', pairKey)
      const chatRef = doc(db, 'chats', pairKey)

      await runTransaction(db, async (transaction) => {
        const chatSnapshot = await transaction.get(chatRef)
        if (chatSnapshot.exists()) throw new Error('chat_exists')

        const requestSnapshot = await transaction.get(requestRef)
        if (requestSnapshot.exists()) {
          const requestData = requestSnapshot.data()
          if (requestData.status === 'pending') {
            if (requestData.fromUid === currentUser.uid) throw new Error('request_already_sent')
            throw new Error('incoming_request_exists')
          }
          if (requestData.status === 'accepted') throw new Error('chat_exists')
        }

        transaction.set(requestRef, {
          fromUid: currentUser.uid,
          toUid: searchResult.uid,
          fromUsername,
          toUsername: searchResult.username,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })

      setSearchResult((previous) => {
        if (!previous || previous.type !== 'user') return previous
        return {
          ...previous,
          relation: 'outgoing_pending',
          requestData: {
            pairKey: previous.pairKey,
            fromUid: currentUser.uid,
            toUid: previous.uid,
            fromUsername,
            toUsername: previous.username,
            status: 'pending',
          },
        }
      })

      setNotice(`Request sent to @${searchResult.username}.`)
    } catch (requestError) {
      if (requestError?.message === 'chat_exists') {
        setNotice('Chat already exists with this user.')
      } else if (requestError?.message === 'request_already_sent') {
        setNotice('Request already sent.')
      } else if (requestError?.message === 'incoming_request_exists') {
        setNotice('This user already sent you a request. Open Requests to accept.')
      } else {
        setError(getFriendlyErrorWithCode(requestError))
      }
    } finally {
      setIsSendingRequest(false)
    }
  }

  const handleRespondToRequest = async (requestItem, decision) => {
    if (!currentUser?.uid || !requestItem?.pairKey) return
    if (requestActionBusyKey) return

    setRequestActionBusyKey(requestItem.pairKey)
    setError('')
    setNotice('')

    try {
      const requestRef = doc(db, 'requests', requestItem.pairKey)
      const chatRef = doc(db, 'chats', requestItem.pairKey)

      await runTransaction(db, async (transaction) => {
        const requestSnapshot = await transaction.get(requestRef)
        if (!requestSnapshot.exists()) throw new Error('request_missing')

        const requestData = requestSnapshot.data()
        if (requestData.toUid !== currentUser.uid) throw new Error('request_not_mine')
        if (requestData.status !== 'pending') throw new Error('request_not_pending')

        if (decision === 'accepted') {
          const chatSnapshot = await transaction.get(chatRef)
          if (!chatSnapshot.exists()) {
            transaction.set(chatRef, {
              participants: [requestData.fromUid, requestData.toUid],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        }

        transaction.update(requestRef, {
          status: decision,
          updatedAt: serverTimestamp(),
        })
      })

      if (decision === 'accepted') {
        setNotice(`Accepted request from @${requestItem.fromUsername}.`)
      } else {
        setNotice(`Rejected request from @${requestItem.fromUsername}.`)
      }

      setSearchResult((previous) => {
        if (!previous || previous.type !== 'user') return previous
        if (previous.pairKey !== requestItem.pairKey) return previous
        return {
          ...previous,
          relation: decision === 'accepted' ? 'chat_exists' : 'can_request',
        }
      })
    } catch (requestError) {
      if (requestError?.message === 'request_not_pending') {
        setNotice('Request already processed.')
      } else {
        setError(getFriendlyErrorWithCode(requestError))
      }
    } finally {
      setRequestActionBusyKey('')
    }
  }

  const handleOpenChat = (chatEntry) => {
    setActivePage('home')
    setActiveChat({
      pairKey: chatEntry.pairKey,
      otherUid: chatEntry.otherUid,
      otherUsername: chatEntry.otherUsername,
    })
    setDraftMessage('')
  }

  const handleSendMessage = async (event) => {
    event.preventDefault()
    if (!currentUser?.uid || !activeChat?.pairKey || isSendingMessage) return

    const nextText = draftMessage.trim()
    if (!nextText) return

    setError('')
    setNotice('')
    setIsSendingMessage(true)

    try {
      const senderUsername = profileUsername || currentUser.displayName || 'user'
      const seenBy = {}
      seenBy[currentUser.uid] = true

      await addDoc(collection(db, 'chats', activeChat.pairKey, 'messages'), {
        senderUid: currentUser.uid,
        senderUsername,
        text: nextText,
        createdAt: serverTimestamp(),
        seenBy,
      })

      setDraftMessage('')
    } catch (sendError) {
      setError(getFriendlyErrorWithCode(sendError))
    } finally {
      setIsSendingMessage(false)
    }
  }

  const handleMessagePress = (messageId, isMine) => {
    if (!isTouchDevice || !isMine) return
    setDeleteArmedMessageId((previous) => (previous === messageId ? '' : messageId))
  }

  const handleDeleteMessage = async (message) => {
    if (!currentUser?.uid || !activeChat?.pairKey || !message?.id) return
    if (message.senderUid !== currentUser.uid || deletingMessageId) return

    setDeletingMessageId(message.id)
    setError('')
    setNotice('')

    try {
      await deleteDoc(doc(db, 'chats', activeChat.pairKey, 'messages', message.id))
      setDeleteArmedMessageId('')
      setNotice('Message deleted.')
    } catch (deleteError) {
      setError(getFriendlyErrorWithCode(deleteError))
    } finally {
      setDeletingMessageId('')
    }
  }

  const handleStartProfileEdit = () => {
    setError('')
    setNotice('')
    setIsEditingProfile(true)
    setDraftProfileBio(profileBio)
    setDraftProfilePhotoUrl(profilePhotoUrl)
  }

  const handleCancelProfileEdit = () => {
    setIsEditingProfile(false)
    setDraftProfileBio(profileBio)
    setDraftProfilePhotoUrl(profilePhotoUrl)
    if (profilePhotoInputRef.current) {
      profilePhotoInputRef.current.value = ''
    }
  }

  const handleOpenProfilePhotoPicker = () => {
    if (!isEditingProfile || isUploadingProfilePhoto || isSavingProfile) return
    profilePhotoInputRef.current?.click()
  }

  const handleProfilePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !currentUser?.uid) return

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file only.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setError('Image must be under 5 MB.')
      event.target.value = ''
      return
    }

    setError('')
    setNotice('')
    setIsUploadingProfilePhoto(true)

    try {
      const nextPhotoUrl = await convertImageFileToDataUrl(file)
      setDraftProfilePhotoUrl(nextPhotoUrl)
      setNotice('Profile image ready. Click Save to apply.')
    } catch (uploadError) {
      setError(getFriendlyErrorWithCode(uploadError))
    } finally {
      setIsUploadingProfilePhoto(false)
      event.target.value = ''
    }
  }

  const handleSaveProfile = async () => {
    if (!currentUser || isSavingProfile) return

    const nextBio = draftProfileBio.slice(0, MAX_BIO_LENGTH)
    const nextProfilePhotoUrl = draftProfilePhotoUrl.trim()
    setError('')
    setNotice('')
    setIsSavingProfile(true)

    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          bio: nextBio,
          profilePhotoUrl: nextProfilePhotoUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      setProfileBio(nextBio)
      setProfilePhotoUrl(nextProfilePhotoUrl)
      setIsEditingProfile(false)
      setNotice('Profile updated.')
    } catch (saveError) {
      setError(getFriendlyErrorWithCode(saveError))
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleOpenStatusPicker = () => {
    if (!currentUser?.uid || isUploadingStatus) return
    statusPhotoInputRef.current?.click()
  }

  const handleStatusUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !currentUser?.uid) return

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for status.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_STATUS_IMAGE_SIZE) {
      setError('Status image must be under 5 MB.')
      event.target.value = ''
      return
    }

    setError('')
    setNotice('')
    setIsUploadingStatus(true)

    try {
      const imageUrl = await convertImageFileToDataUrl(file)
      setNotice('Image converted. Saving in cloud database...')
      const acceptedPairKeySetForStatus = new Set(acceptedPairKeys)
      const audienceUidSet = new Set([currentUser.uid])

      for (const chat of chats) {
        if (!acceptedPairKeySetForStatus.has(chat.pairKey)) continue
        const participants = Array.isArray(chat.participants) ? chat.participants : []
        for (const participantUid of participants) {
          if (!participantUid || participantUid === currentUser.uid) continue
          audienceUidSet.add(participantUid)
        }
      }

      const ownerUsername = profileUsername || currentUser.displayName || 'user'

      await setDoc(
        doc(db, 'statuses', currentUser.uid),
        {
          ownerUid: currentUser.uid,
          ownerUsername,
          ownerProfilePhotoUrl: profilePhotoUrl || '',
          imageUrl,
          audienceUids: Array.from(audienceUidSet),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAtMs: Date.now() + STATUS_EXPIRY_MS,
        },
      )

      setNotice('Status uploaded.')
    } catch (uploadError) {
      setError(getFriendlyErrorWithCode(uploadError))
    } finally {
      setIsUploadingStatus(false)
      event.target.value = ''
    }
  }

  const handleOpenStatusViewer = (statusItem) => {
    if (!statusItem?.imageUrl) return
    setStatusViewerItem(statusItem)
  }

  const handleCloseStatusViewer = () => {
    setStatusViewerItem(null)
  }

  const handleSendChangePasswordEmail = async () => {
    if (!currentUser?.email || isSendingPasswordLink) return

    setError('')
    setNotice('')
    setIsSendingPasswordLink(true)

    try {
      await sendPasswordResetLink(currentUser.email)
      setNotice(`Password change link sent to ${currentUser.email}.`)
    } catch (sendError) {
      setError(getFriendlyErrorWithCode(sendError))
    } finally {
      setIsSendingPasswordLink(false)
    }
  }

  const handleRefreshVerification = async () => {
    if (!currentUser || isLoading) return

    setIsLoading(true)
    setError('')
    setNotice('')

    try {
      await reload(currentUser)
      const refreshedUser = auth.currentUser
      setCurrentUser(refreshedUser)

      if (refreshedUser?.emailVerified) {
        await markEmailVerifiedInDb(refreshedUser)
        setNotice('Email verified. Entering first page.')
      } else {
        setNotice('Email is still not verified. Check inbox/spam and try again.')
      }
    } catch (refreshError) {
      setError(getFriendlyErrorWithCode(refreshError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!currentUser || isLoading) return

    setIsLoading(true)
    setError('')
    setNotice('')

    try {
      await sendVerificationLink(currentUser)
      setNotice(`Verification link resent to ${currentUser.email}.`)
    } catch (verificationError) {
      setError(getFriendlyErrorWithCode(verificationError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    if (isLoading) return

    setIsLoading(true)
    setError('')
    setNotice('')

    try {
      await signOut(auth)
      setMode('login')
      setUsernameStatus('idle')
      setActivePage('home')
      setSearchUsername('')
      setSearchResult(null)
      setShowRequests(false)
      setIncomingRequests([])
      setAcceptedPairKeys([])
      setRequestActionBusyKey('')
      setChats([])
      setUserCache({})
      setActiveChat(null)
      setChatMessages([])
      setDraftMessage('')
      setStatuses([])
      setIsUploadingStatus(false)
      setStatusViewerItem(null)
      setIsEditingProfile(false)
      setIsSavingProfile(false)
      setIsUploadingProfilePhoto(false)
      setProfileUsername('')
      setProfileBio('')
      setProfilePhotoUrl('')
      setDraftProfileBio('')
      setDraftProfilePhotoUrl('')
      setUsername('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (logoutError) {
      setError(getFriendlyErrorWithCode(logoutError))
    } finally {
      setIsLoading(false)
    }
  }

  const displayName = currentUser?.displayName?.trim()
  const activeUsername = profileUsername || displayName || 'user'
  const profileInitial = activeUsername.slice(0, 1).toUpperCase() || 'U'
  const displayedProfilePhotoUrl = isEditingProfile ? draftProfilePhotoUrl : profilePhotoUrl
  const displayedProfileBio = isEditingProfile ? draftProfileBio : profileBio
  const acceptedPairKeySet = useMemo(() => new Set(acceptedPairKeys), [acceptedPairKeys])
  const friendUidSet = useMemo(() => {
    if (!currentUser?.uid) return new Set()

    const nextSet = new Set()
    for (const chat of chats) {
      if (!acceptedPairKeySet.has(chat.pairKey)) continue
      const participants = Array.isArray(chat.participants) ? chat.participants : []
      for (const participantUid of participants) {
        if (participantUid && participantUid !== currentUser.uid) {
          nextSet.add(participantUid)
        }
      }
    }
    return nextSet
  }, [acceptedPairKeySet, chats, currentUser?.uid])

  const visibleStatuses = useMemo(() => {
    const now = Date.now()

    return statuses
      .filter((statusItem) => {
        if (!statusItem.imageUrl) return false
        if (!statusItem.expiresAtMs) return false
        return statusItem.expiresAtMs > now
      })
      .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))
  }, [statuses])

  const myStatus = useMemo(() => {
    if (!currentUser?.uid) return null
    return visibleStatuses.find((statusItem) => statusItem.ownerUid === currentUser.uid) || null
  }, [currentUser?.uid, visibleStatuses])

  const friendStatuses = useMemo(
    () =>
      visibleStatuses.filter((statusItem) => {
        if (statusItem.ownerUid === currentUser?.uid) return false
        if (!friendUidSet.has(statusItem.ownerUid)) return false
        return !HIDDEN_CHAT_USERNAMES.has((statusItem.ownerUsername || '').toLowerCase())
      }),
    [currentUser?.uid, friendUidSet, visibleStatuses],
  )

  const chatEntries = useMemo(() => {
    if (!currentUser?.uid) return []

    return chats
      .filter((chat) => acceptedPairKeySet.has(chat.pairKey))
      .map((chat) => {
        const participants = Array.isArray(chat.participants) ? chat.participants : []
        const otherUid = participants.find((uid) => uid !== currentUser.uid)
        if (!otherUid) return null

        const cachedUser = userCache[otherUid]
        const otherUsername = cachedUser?.username || 'user'
        if (HIDDEN_CHAT_USERNAMES.has(otherUsername.toLowerCase())) return null

        return {
          pairKey: chat.pairKey,
          otherUid,
          otherUsername,
          online: false,
          incoming: 0,
          updatedAt: chat.updatedAt || chat.createdAt || null,
        }
      })
      .filter(Boolean)
      .sort((left, right) => toMillis(right.updatedAt) - toMillis(left.updatedAt))
  }, [acceptedPairKeySet, chats, currentUser?.uid, userCache])

  const incomingTotal = chatEntries.reduce((sum, item) => sum + item.incoming, 0)
  const isSubmitDisabled =
    isLoading || (mode === 'signup' && ['checking', 'taken', 'invalid'].includes(usernameStatus))
  const isSearchResultBusy = isSendingRequest || requestActionBusyKey !== ''

  return (
    <main className="auth-shell">
      <section className={currentUser ? 'auth-card auth-card--app' : 'auth-card auth-card--guest'}>
        <header className="auth-head">
          <p className="badge">A3 Chat</p>
          <h1>{currentUser ? `Welcome back, ${activeUsername}` : 'Secure Account Access'}</h1>
          <p className="subtitle">
            {currentUser
              ? currentUser.emailVerified
                ? 'Your account is active and connected.'
                : 'Confirm your email before entering the app.'
              : 'Sign in or create your account to continue.'}
          </p>
        </header>

        {notice ? <p className="notice-msg">{notice}</p> : null}
        {error ? <p className="error-msg">{error}</p> : null}

        {isCheckingSession ? (
          <p className="status">Checking session...</p>
        ) : currentUser ? (
          currentUser.emailVerified ? (
            <div className="app-page-wrap">
              {activePage === 'home' ? (
                <section className="home-panel">
                  {activeChat ? (
                    <>
                      <div className="message-page-head">
                        <button type="button" className="search-action secondary" onClick={() => setActiveChat(null)}>
                          Back to chats
                        </button>
                        <div>
                          <span className="message-page-title">@{activeChat.otherUsername}</span>
                          <p className="message-page-subtitle">Direct conversation</p>
                        </div>
                      </div>

                      <div className="message-list message-page-list">
                        {chatMessages.length ? (
                          chatMessages.map((message) => {
                            const isMine = message.senderUid === currentUser.uid
                            const isSeenByOther =
                              isMine &&
                              activeChat.otherUid &&
                              typeof message.seenBy === 'object' &&
                              message.seenBy !== null &&
                              message.seenBy[activeChat.otherUid] === true

                            const ticks = isSeenByOther ? '\u2713\u2713' : '\u2713'
                            const tickLabel = isSeenByOther ? 'Seen' : 'Sent'

                            return (
                              <article
                                key={message.id}
                                className={
                                  isMine && deleteArmedMessageId === message.id
                                    ? 'message-item mine show-delete'
                                    : isMine
                                      ? 'message-item mine'
                                      : 'message-item'
                                }
                                onClick={() => handleMessagePress(message.id, isMine)}
                              >
                                {isMine ? (
                                  <button
                                    type="button"
                                    className="message-delete-btn"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleDeleteMessage(message)
                                    }}
                                    disabled={deletingMessageId === message.id}
                                  >
                                    {deletingMessageId === message.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                ) : null}
                                <p className="message-text">{message.text}</p>
                                <p className="message-meta">
                                  {isMine ? 'you' : `@${activeChat.otherUsername}`} - {formatMessageTime(message.createdAt)}
                                  {isMine ? (
                                    <span
                                      className={isSeenByOther ? 'message-ticks seen' : 'message-ticks sent'}
                                      aria-label={tickLabel}
                                      title={tickLabel}
                                    >
                                      {' '}
                                      {ticks}
                                    </span>
                                  ) : null}
                                </p>
                              </article>
                            )
                          })
                        ) : (
                          <p className="empty-state">No messages yet. Start the conversation.</p>
                        )}
                      </div>

                      <form className="message-form" onSubmit={handleSendMessage}>
                        <input
                          type="text"
                          value={draftMessage}
                          onChange={(event) => setDraftMessage(event.target.value)}
                          placeholder={`Message @${activeChat.otherUsername}`}
                          autoComplete="off"
                        />
                        <button type="submit" className="search-btn" disabled={isSendingMessage || !draftMessage.trim()}>
                          {isSendingMessage ? 'Sending...' : 'Send'}
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <div className="home-actions">
                        <button
                          type="button"
                          className="search-action secondary"
                          onClick={() => setShowRequests((previous) => !previous)}
                        >
                          Requests ({incomingRequests.length})
                        </button>
                        <button type="button" className="search-action secondary" onClick={handleLogout} disabled={isLoading}>
                          {isLoading ? 'Please wait...' : 'Sign out'}
                        </button>
                      </div>

                      <form className="search-wrap home-search-bar" onSubmit={handleSearchSubmit}>
                        <span className="search-icon" aria-hidden>
                          <svg viewBox="0 0 24 24" className="search-icon-svg">
                            <path d="M10.4 3a7.4 7.4 0 1 0 4.8 13l4.1 4.1 1.7-1.7-4.1-4.1A7.4 7.4 0 0 0 10.4 3m0 2.4a5 5 0 1 1 0 10 5 5 0 0 1 0-10" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          value={searchUsername}
                          onChange={(event) => setSearchUsername(event.target.value)}
                          placeholder="Search username"
                          autoComplete="off"
                        />
                        <button type="submit" className="search-btn" disabled={isSearchingUsers}>
                          {isSearchingUsers ? 'Searching...' : 'Search'}
                        </button>
                      </form>

                      {searchResult ? (
                        <div className="search-results-panel">
                          <div className="search-results">
                            {searchResult.type === 'not_found' ? (
                              <p className="empty-state">No user found for "{searchResult.query}".</p>
                            ) : null}

                            {searchResult.type === 'self' ? (
                              <p className="empty-state">You searched your own username (@{searchResult.username}).</p>
                            ) : null}

                            {searchResult.type === 'user' ? (
                              <div className="search-item">
                                <div>
                                  <p className="result-name">@{searchResult.username}</p>
                                  <p className="result-meta">Search by username to send request.</p>
                                </div>

                                {searchResult.relation === 'can_request' ? (
                                  <button
                                    type="button"
                                    className="request-btn"
                                    onClick={handleSendRequest}
                                    disabled={isSearchResultBusy}
                                  >
                                    {isSendingRequest ? 'Sending...' : 'Send request'}
                                  </button>
                                ) : null}

                                {searchResult.relation === 'outgoing_pending' ? (
                                  <span className="pending-tag">Request sent</span>
                                ) : null}

                                {searchResult.relation === 'incoming_pending' ? (
                                  <div className="request-actions">
                                    <button
                                      type="button"
                                      className="request-btn"
                                      onClick={() => handleRespondToRequest(searchResult.requestData, 'accepted')}
                                      disabled={isSearchResultBusy}
                                    >
                                      {requestActionBusyKey === searchResult.pairKey ? 'Accepting...' : 'Accept'}
                                    </button>
                                    <button
                                      type="button"
                                      className="request-btn secondary"
                                      onClick={() => handleRespondToRequest(searchResult.requestData, 'rejected')}
                                      disabled={isSearchResultBusy}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : null}

                                {searchResult.relation === 'chat_exists' ? (
                                  <button
                                    type="button"
                                    className="request-btn secondary"
                                    onClick={() =>
                                      handleOpenChat({
                                        pairKey: searchResult.pairKey,
                                        otherUid: searchResult.uid,
                                        otherUsername: searchResult.username,
                                      })
                                    }
                                  >
                                    Open chat
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {showRequests ? (
                        <div>
                          <p className="list-title">Requests</p>
                          <div className="request-list">
                            {incomingRequests.length ? (
                              incomingRequests.map((requestItem) => {
                                const isBusy = requestActionBusyKey === requestItem.pairKey

                                return (
                                  <div key={requestItem.pairKey} className="request-item">
                                    <div>
                                      <p className="result-name">@{requestItem.fromUsername}</p>
                                      <p className="result-meta">Wants to chat with you.</p>
                                    </div>
                                    <div className="request-actions">
                                      <button
                                        type="button"
                                        className="request-btn"
                                        onClick={() => handleRespondToRequest(requestItem, 'accepted')}
                                        disabled={isBusy}
                                      >
                                        {isBusy ? 'Accepting...' : 'Accept'}
                                      </button>
                                      <button
                                        type="button"
                                        className="request-btn secondary"
                                        onClick={() => handleRespondToRequest(requestItem, 'rejected')}
                                        disabled={isBusy}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <p className="empty-state">No pending requests.</p>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div>
                        <p className="list-title">Chat list</p>
                        <p className="incoming-total">Incoming total messages: {incomingTotal}</p>
                      </div>

                      <div className="chat-list">
                        {chatEntries.length ? (
                          chatEntries.map((chat) => (
                            <div key={chat.pairKey} className="chat-item active">
                              <div className="chat-main">
                                <p className="result-name">@{chat.otherUsername}</p>
                              </div>
                              <div className="chat-end">
                                <span className={chat.online ? 'presence-pill' : 'presence-pill offline'}>
                                  {chat.online ? 'Active' : 'Offline'}
                                </span>
                                <button
                                  type="button"
                                  className="chat-open-btn"
                                  onClick={() => handleOpenChat(chat)}
                                  aria-label={`Open chat with @${chat.otherUsername}`}
                                >
                                  {'>'}
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="empty-state">No chats yet. Search username and send request.</p>
                        )}
                      </div>
                    </>
                  )}
                </section>
              ) : activePage === 'status' ? (
                <section className="status-panel">
                  <div className="status-upload-card">
                    <div className="status-upload-top">
                      <div className="status-upload-avatar-wrap">
                        {myStatus?.imageUrl ? (
                          <img src={myStatus.imageUrl} alt="Your status" className="status-upload-avatar-image" />
                        ) : displayedProfilePhotoUrl ? (
                          <img src={displayedProfilePhotoUrl} alt={`${activeUsername} profile`} className="status-upload-avatar-image" />
                        ) : (
                          <span className="status-upload-avatar-fallback">{profileInitial}</span>
                        )}
                        <button
                          type="button"
                          className="status-upload-plus"
                          onClick={handleOpenStatusPicker}
                          disabled={isUploadingStatus}
                          aria-label="Add status"
                        >
                          +
                        </button>
                        <input
                          ref={statusPhotoInputRef}
                          className="profile-photo-input"
                          type="file"
                          accept="image/*"
                          onChange={handleStatusUpload}
                        />
                      </div>

                      <div className="status-upload-copy">
                        <p className="list-title">Add status</p>
                        <p className="result-meta">
                          {myStatus ? `Last status: ${formatStatusTime(myStatus.createdAt)}` : 'Upload a status for your friends.'}
                        </p>
                      </div>
                    </div>

                    <div className="profile-password-actions">
                      <button
                        type="button"
                        className="status-upload-btn"
                        onClick={handleOpenStatusPicker}
                        disabled={isUploadingStatus}
                      >
                        {isUploadingStatus ? 'Uploading...' : 'Upload status'}
                      </button>
                      {myStatus ? (
                        <button type="button" className="status-view-btn" onClick={() => handleOpenStatusViewer(myStatus)}>
                          View
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="list-title">Friends status</p>
                    <div className="status-list">
                      {friendStatuses.length ? (
                        friendStatuses.map((statusItem) => {
                          const friendPhotoUrl = statusItem.ownerProfilePhotoUrl || userCache[statusItem.ownerUid]?.profilePhotoUrl || ''
                          const friendInitial = (statusItem.ownerUsername || 'u').slice(0, 1).toUpperCase()

                          return (
                            <button
                              key={statusItem.ownerUid}
                              type="button"
                              className="status-item"
                              onClick={() => handleOpenStatusViewer(statusItem)}
                            >
                              <div className="status-item-media">
                                {friendPhotoUrl ? (
                                  <img src={friendPhotoUrl} alt={`${statusItem.ownerUsername} profile`} className="status-item-photo" />
                                ) : (
                                  <span className="status-upload-avatar-fallback">{friendInitial}</span>
                                )}
                              </div>
                              <div className="status-item-content">
                                <p className="status-item-name">@{statusItem.ownerUsername}</p>
                                <p className="status-item-meta">{formatStatusTime(statusItem.createdAt)}</p>
                              </div>
                              <span className="status-item-arrow">{'>'}</span>
                            </button>
                          )
                        })
                      ) : (
                        <p className="empty-state">No friends status yet.</p>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <section className="profile-panel">
                  <div className="profile-panel-top">
                    <button type="button" className="link-btn profile-signout" onClick={handleLogout} disabled={isLoading}>
                      {isLoading ? 'Please wait...' : 'Sign out'}
                    </button>
                  </div>

                  <p className="list-title">Profile</p>

                  <div className="profile-card profile-card-page">
                    <div className="profile-head">
                      <div className="profile-avatar-wrap">
                        {displayedProfilePhotoUrl ? (
                          <img src={displayedProfilePhotoUrl} alt={`${activeUsername} profile`} className="profile-avatar-image" />
                        ) : (
                          <span className="profile-avatar-fallback">{profileInitial}</span>
                        )}
                        <button
                          type="button"
                          className="profile-avatar-edit"
                          onClick={handleOpenProfilePhotoPicker}
                          disabled={!isEditingProfile || isUploadingProfilePhoto || isSavingProfile}
                          aria-label="Change profile photo"
                          title={isEditingProfile ? 'Change profile photo' : 'Click Edit to change photo'}
                        >
                          +
                        </button>
                        <input
                          ref={profilePhotoInputRef}
                          className="profile-photo-input"
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePhotoChange}
                        />
                      </div>

                      <div className="profile-head-text">
                        <p className="profile-name">@{activeUsername}</p>
                        <p className="profile-email">{currentUser.email}</p>
                        {isUploadingProfilePhoto ? <p className="result-meta">Uploading image...</p> : null}
                      </div>

                      <button
                        type="button"
                        className="search-action secondary profile-edit-btn"
                        onClick={isEditingProfile ? handleCancelProfileEdit : handleStartProfileEdit}
                        disabled={isSavingProfile || isUploadingProfilePhoto}
                      >
                        {isEditingProfile ? 'Cancel' : 'Edit'}
                      </button>
                    </div>

                    <p className="profile-bio-label">BIO</p>
                    <textarea
                      className="profile-bio-input"
                      value={displayedProfileBio}
                      onChange={(event) => setDraftProfileBio(event.target.value.slice(0, MAX_BIO_LENGTH))}
                      maxLength={MAX_BIO_LENGTH}
                      placeholder="Write your bio"
                      disabled={!isEditingProfile}
                    />

                    <div className="profile-bio-foot">
                      <span>
                        {displayedProfileBio.length}/{MAX_BIO_LENGTH}
                      </span>
                      {isEditingProfile ? (
                        <div className="profile-bio-actions">
                          {draftProfilePhotoUrl ? (
                            <button
                              type="button"
                              className="search-action secondary"
                              onClick={() => setDraftProfilePhotoUrl('')}
                              disabled={isSavingProfile || isUploadingProfilePhoto}
                            >
                              Remove photo
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="search-action secondary"
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile || isUploadingProfilePhoto}
                          >
                            {isSavingProfile ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <hr className="profile-divider" />

                    <p className="list-title profile-password-title">Change password</p>
                    <p className="profile-password-help">
                      Tap the button below to receive a password change link on your email.
                    </p>

                    <div className="profile-password-actions">
                      <button
                        type="button"
                        className="search-action secondary"
                        onClick={handleSendChangePasswordEmail}
                        disabled={isSendingPasswordLink}
                      >
                        {isSendingPasswordLink ? 'Sending...' : 'Send change password email'}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              <nav className="bottom-nav" aria-label="App page navigation">
                <button
                  type="button"
                  className={activePage === 'home' ? 'bottom-nav-item active' : 'bottom-nav-item'}
                  onClick={() => setActivePage('home')}
                >
                  <span className="bottom-nav-bubble">
                    <svg viewBox="0 0 24 24" className="bottom-nav-icon" aria-hidden>
                      <path d="M12 3.5 3 10.6v9.4h6.2v-6.1h5.6V20H21v-9.4z" />
                    </svg>
                  </span>
                  <span className="bottom-nav-label">Home</span>
                </button>

                <button
                  type="button"
                  className={activePage === 'status' ? 'bottom-nav-item active' : 'bottom-nav-item'}
                  onClick={() => setActivePage('status')}
                >
                  <span className="bottom-nav-bubble">
                    <svg viewBox="0 0 24 24" className="bottom-nav-icon" aria-hidden>
                      <path d="M11 4h2v16h-2zM4 11h16v2H4z" />
                    </svg>
                  </span>
                  <span className="bottom-nav-label">Status</span>
                </button>

                <button
                  type="button"
                  className={activePage === 'profile' ? 'bottom-nav-item active' : 'bottom-nav-item'}
                  onClick={() => setActivePage('profile')}
                >
                  <span className="bottom-nav-bubble">
                    <svg viewBox="0 0 24 24" className="bottom-nav-icon" aria-hidden>
                      <path d="M12 12.3a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8m0 2.2c-4.5 0-8 2.3-8 5v1h16v-1c0-2.7-3.5-5-8-5" />
                    </svg>
                  </span>
                  <span className="bottom-nav-label">Profile</span>
                </button>
              </nav>

              {statusViewerItem ? (
                <div className="status-viewer-backdrop" onClick={handleCloseStatusViewer}>
                  <div className="status-viewer" onClick={(event) => event.stopPropagation()}>
                    <div className="status-viewer-progress">
                      <span
                        key={`${statusViewerItem.ownerUid}-${toMillis(statusViewerItem.createdAt)}`}
                        className="status-viewer-progress-fill"
                      />
                    </div>
                    <button type="button" className="status-viewer-close" onClick={handleCloseStatusViewer} aria-label="Close">
                      x
                    </button>
                    <p className="status-viewer-name">@{statusViewerItem.ownerUsername}</p>
                    <img src={statusViewerItem.imageUrl} alt={`${statusViewerItem.ownerUsername} status`} className="status-viewer-image" />
                    <p className="status-item-meta">Closes automatically in 15 seconds.</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="verification-panel">
              <p>
                Confirm your email before entering the app. A link was sent to:
                <br />
                <strong>{currentUser.email}</strong>
              </p>
              <div className="panel-actions">
                <button type="button" className="submit-btn" onClick={handleRefreshVerification} disabled={isLoading}>
                  {isLoading ? 'Checking...' : 'I confirmed the link'}
                </button>
                <button type="button" className="secondary-btn" onClick={handleResendVerification} disabled={isLoading}>
                  Resend verification email
                </button>
              </div>
              <button type="button" className="link-btn" onClick={handleLogout} disabled={isLoading}>
                Use another account
              </button>
            </div>
          )
        ) : (
          <>
            <div className="mode-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={mode === 'login' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchMode('login')}
                disabled={isLoading}
              >
                Log in
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchMode('signup')}
                disabled={isLoading}
              >
                Sign up
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
              {mode === 'signup' ? (
                <label className="field">
                  Username
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    onBlur={handleUsernameBlur}
                    placeholder="Choose a unique username"
                    autoComplete="username"
                    disabled={isLoading}
                  />
                  {getUsernameStatusText() ? (
                    <span className={`username-status ${usernameStatus}`}>{getUsernameStatusText()}</span>
                  ) : null}
                </label>
              ) : null}

              <label className="field">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="off"
                  disabled={isLoading}
                />
              </label>

              <label className="field">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                  autoComplete="off"
                  maxLength={mode === 'signup' ? MAX_PASSWORD_LENGTH : undefined}
                  disabled={isLoading}
                />
              </label>

              {mode === 'login' ? (
                <div className="field-inline-action">
                  <button type="button" className="link-btn" onClick={handleForgotPassword} disabled={isLoading}>
                    Forgot password?
                  </button>
                </div>
              ) : null}

              {mode === 'signup' ? (
                <label className="field">
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="off"
                    maxLength={MAX_PASSWORD_LENGTH}
                    disabled={isLoading}
                  />
                </label>
              ) : null}

              <button type="submit" className="submit-btn" disabled={isSubmitDisabled}>
                {isLoading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Log in'}
              </button>
            </form>

            <div className="helper-text">
              {mode === 'login' ? (
                <p>
                  New here?{' '}
                  <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
                    Create an account
                  </button>
                </p>
              ) : (
                <p>
                  Already registered?{' '}
                  <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default App
