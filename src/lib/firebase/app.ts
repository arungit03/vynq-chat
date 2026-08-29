import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import firebaseConfig, { isFirebaseConfigured } from "./config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);
} else {
  // Avoid throwing at import time; services are null until configured.
  // Callers that need them will throw a friendly error via requireFirebase().
}

export function requireFirebase() {
  if (!app || !auth || !db || !storage) {
    throw new Error(
      "Firebase is not configured. Add your web config to .env (see .env.example).",
    );
  }
  return { app, auth, db, storage };
}

export function requireFunctions() {
  if (!functions) {
    throw new Error(
      "Firebase is not configured. Add your web config to .env (see .env.example).",
    );
  }
  return functions;
}

export { app, auth, db, storage, functions };
