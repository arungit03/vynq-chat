import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseApp } from "./init";

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export const googleProvider = new GoogleAuthProvider();

// Where the app lives. Used for Firebase email-link Auth (must be an authorized
// domain in the Firebase console) and for building absolute redirect URLs.
export const appOrigin =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

// Path the email-link sign-in completes on.
export const EMAIL_LINK_FINISH_PATH = "/verify-email";

export const privateMediaBucket = "private-media";
