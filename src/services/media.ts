import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { requireFirebase } from "@/lib/firebase/app";
import { LIMITS, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES } from "@/lib/constants";
import { friendlyError } from "@/lib/errorMap";

export function mb(bytes: number): number {
  return bytes / (1024 * 1024);
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Unsupported image type. Use JPEG, PNG, or WebP.";
  if (mb(file.size) > LIMITS.IMAGE_MAX_MB) return `Image must be ${LIMITS.IMAGE_MAX_MB} MB or smaller.`;
  return null;
}

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) return "Unsupported video type. Use MP4, WebM, or MOV.";
  if (mb(file.size) > LIMITS.VIDEO_MAX_MB) return `Video must be ${LIMITS.VIDEO_MAX_MB} MB or smaller.`;
  return null;
}

export interface UploadProgress {
  progress: number; // 0..1
  url?: string;
}

/** Upload chat media to /chatMedia/{chatId}/{messageId}/{name}. Rules enforce membership. */
export async function uploadChatMedia(params: {
  chatId: string;
  messageId: string;
  file: File;
  onProgress?: (p: number) => void;
}): Promise<{ url: string; path: string; contentType: string }> {
  const { storage } = requireFirebase();
  const { chatId, messageId, file, onProgress } = params;
  const safeName = encodeURIComponent(file.name.replace(/[^\w.-]/g, "_"));
  const path = `chatMedia/${chatId}/${messageId}/${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { chatId, messageId, uploadedAt: String(Date.now()) },
  });
  const url = await new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        const p = snap.bytesTransferred / snap.totalBytes;
        onProgress?.(p);
      },
      (err) => reject(err),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (e) {
          reject(e);
        }
      },
    );
  });
  return { url, path, contentType: file.type };
}

/** Upload profile picture to /profilePictures/{uid}/{name}. */
export async function uploadProfilePicture(uid: string, file: File): Promise<{ url: string; path: string }> {
  const { storage } = requireFirebase();
  if (mb(file.size) > LIMITS.IMAGE_MAX_MB) throw new Error(`Image must be ${LIMITS.IMAGE_MAX_MB} MB or smaller.`);
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("Unsupported image type. Use JPEG, PNG, or WebP.");
  const safeName = encodeURIComponent(file.name.replace(/[^\w.-]/g, "_"));
  const path = `profilePictures/${uid}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  // uploadBytesResumable returns an UploadTask; awaiting it does not wait for
  // completion. Use uploadBytes here because profile uploads do not need a
  // progress callback, then fetch the URL only after the write is complete.
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/** Upload status media to /statusMedia/{uid}/{statusId}/{name}. */
export async function uploadStatusMedia(params: {
  uid: string;
  statusId: string;
  file: File;
  onProgress?: (p: number) => void;
}): Promise<{ url: string; path: string; contentType: string }> {
  const { storage } = requireFirebase();
  const { uid, statusId, file, onProgress } = params;
  const safeName = encodeURIComponent(file.name.replace(/[^\w.-]/g, "_"));
  const path = `statusMedia/${uid}/${statusId}/${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { uid, statusId },
  });
  const url = await new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes),
      (err) => reject(err),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (e) {
          reject(e);
        }
      },
    );
  });
  return { url, path, contentType: file.type };
}

export async function deleteStorageObject(path: string): Promise<void> {
  const { storage } = requireFirebase();
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    // Idempotent: ignore not-found.
    console.warn("deleteStorageObject skipped:", friendlyError(e));
  }
}

export function getMediaDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve({ width: 0, height: 0 });
      video.src = URL.createObjectURL(file);
    }
  });
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}
