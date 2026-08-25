"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { enableFirebaseAppCheck, firebaseAppCheckSiteKey, firebaseConfig, firebaseFunctionsRegion, useFirebaseEmulators } from "@/lib/firebase/config";

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

if (typeof window !== "undefined" && enableFirebaseAppCheck && firebaseAppCheckSiteKey) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(firebaseAppCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const rtdb = getDatabase(firebaseApp);
export const functions = getFunctions(firebaseApp, firebaseFunctionsRegion);

let emulatorsConnected = false;

function connectToLocalEmulators() {
  if (!useFirebaseEmulators || typeof window === "undefined" || emulatorsConnected) return;

  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectDatabaseEmulator(rtdb, "127.0.0.1", 9000);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  emulatorsConnected = true;
}

connectToLocalEmulators();

/** Analytics only resolves in a browser that supports Firebase Analytics. */
export const analyticsPromise: Promise<Analytics | null> =
  typeof window === "undefined"
    ? Promise.resolve(null)
    : isSupported().then((supported) => (supported ? getAnalytics(firebaseApp) : null));

export { firebaseApp, connectToLocalEmulators };
