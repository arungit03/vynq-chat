import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  applyActionCode,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { requireFirebase } from "@/lib/firebase/app";
import { LIMITS } from "@/lib/constants";

export async function registerWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const { auth } = requireFirebase();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function sendVerificationEmail(user: User) {
  // Firebase Auth handles delivery using the project's email template.
  await sendEmailVerification(user);
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const { auth } = requireFirebase();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  const { auth } = requireFirebase();
  await signOut(auth);
}

export async function resetPassword(email: string) {
  const { auth } = requireFirebase();
  await sendPasswordResetEmail(auth, email);
}

export async function refreshEmailVerified(user: User): Promise<boolean> {
  await reload(user);
  return user.emailVerified;
}

export async function confirmEmailVerification(oobCode: string) {
  const { auth } = requireFirebase();
  await applyActionCode(auth, oobCode);
}

export async function changePassword(user: User, currentPassword: string, newPassword: string) {
  // Re-authenticate then update.
  const cred = EmailAuthProvider.credential(user.email!, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}

export { LIMITS };
