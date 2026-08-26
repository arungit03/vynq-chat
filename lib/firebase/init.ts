// Firebase is now the full backend for Vynq-chat: Auth, Firestore, and Storage.
// (It also serves the static SPA via Firebase Hosting.)
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDsTehIbIV6U0WxcteI_1MGwZFYbEu8XDU",
  authDomain: "vynq-chat.firebaseapp.com",
  databaseURL: "https://vynq-chat-default-rtdb.firebaseio.com",
  projectId: "vynq-chat",
  storageBucket: "vynq-chat.firebasestorage.app",
  messagingSenderId: "998442115242",
  appId: "1:998442115242:web:aa828d98187391404e30d3",
  measurementId: "G-2J4TC3XP7B",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAnalytics = getAnalytics(firebaseApp);
