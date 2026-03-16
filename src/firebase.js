import { initializeApp } from '@firebase/app'
import { browserSessionPersistence, getAuth, onAuthStateChanged, setPersistence } from '@firebase/auth'
import { getFirestore } from '@firebase/firestore'

// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAchDpZDEnr5FvqkfG1hDtOaBRDoZ1SN4Y',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'a3chat03.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'a3chat03',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'a3chat03.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1024381965367',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1024381965367:web:253642250c87a0a9c41bb2',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-T6BLTH69PJ',
}

// Initialize Firebase
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
