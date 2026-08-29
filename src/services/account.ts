import { httpsCallable } from "firebase/functions";
import { requireFunctions } from "@/lib/firebase/app";

/**
 * Account deletion is server-authoritative. The client cannot delete its own
 * Firestore documents (security rules forbid deletion — never trust the client),
 * so we invoke the `deleteAccount` Cloud Function, which runs with admin
 * privileges and removes the profile, friend graph, statuses, conversations,
 * notifications, Storage objects, and the Auth user.
 */
export async function deleteAccountCompletely(_myUid: string): Promise<void> {
  const functions = requireFunctions();
  const callable = httpsCallable<unknown, { deleted: boolean }>(functions, "deleteAccount");
  await callable();
}
