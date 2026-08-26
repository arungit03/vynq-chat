import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { storage } from "./client";

/** Uploads a private media file and returns its storage path (for Firestore). */
export async function uploadPrivateMedia(path: string, file: Blob | Uint8Array | ArrayBuffer): Promise<void> {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file as Blob);
}

/** Returns a temporary HTTPS URL for a stored private media file. */
export async function getPrivateMediaUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}

/** Downloads a stored private media file as a Blob. */
export async function downloadPrivateMedia(path: string): Promise<Blob> {
  const url = await getDownloadURL(ref(storage, path));
  const response = await fetch(url);
  if (!response.ok) throw new Error("The private media could not be downloaded.");
  return response.blob();
}

export async function removePrivateMedia(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Already gone; ignore.
  }
}
