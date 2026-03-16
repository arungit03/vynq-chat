import { initializeApp } from '@firebase/app'
import { browserSessionPersistence, getAuth, onAuthStateChanged, setPersistence } from '@firebase/auth'
import { getFirestore } from '@firebase/firestore'

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const missingEnvVars = requiredEnvVars.filter((key) => !import.meta.env[key])

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingEnvVars.join(', ')}. Add them to your .env file.`,
  )
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    ? { measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID }
    : {}),
}

const app = initializeApp(firebaseConfig)

let analytics = null
if (typeof window !== 'undefined') {
  import('@firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (typeof isSupported === 'function' && !(await isSupported())) return
      analytics = getAnalytics(app)
    })
    .catch(() => {
      analytics = null
    })
}

const auth = getAuth(app)
const db = getFirestore(app)

const authReady = setPersistence(auth, browserSessionPersistence)
  .catch(() => undefined)
  .then(
    () =>
      new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, () => {
          unsubscribe()
          resolve()
        })
      }),
  )

export { app, analytics, auth, db, authReady }
