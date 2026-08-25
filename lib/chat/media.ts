import type { ChatMediaKind } from "@/lib/chat/types";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 30;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export type PreparedMedia = {
  file: File;
  kind: ChatMediaKind;
  durationSeconds: number | null;
};

function createMediaError(message: string) {
  return new Error(message);
}

function getImageSource(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(createMediaError("This image could not be read."));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, contentType: "image/webp" | "image/jpeg") {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(createMediaError("This image could not be compressed."));
    }, contentType, 0.84);
  });
}

function imageOutputType(blob: Blob): "image/webp" | "image/jpeg" | "image/png" {
  if (blob.type === "image/webp" || blob.type === "image/jpeg" || blob.type === "image/png") return blob.type;
  throw createMediaError("Your browser returned an unsupported compressed image format.");
}

async function compressImage(file: File): Promise<File> {
  const image = await getImageSource(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestEdge > 2048 ? 2048 / longestEdge : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw createMediaError("Your browser cannot prepare this image.");
  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasBlob(canvas, "image/webp");
  let contentType = imageOutputType(blob);
  if (blob.size > MAX_IMAGE_BYTES) {
    blob = await canvasBlob(canvas, "image/jpeg");
    contentType = imageOutputType(blob);
  }
  if (blob.size > MAX_IMAGE_BYTES) throw createMediaError("Choose a smaller image. Compressed images must be under 5 MB.");

  const extension = contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  return new File([blob], `vynq-image.${extension}`, { type: contentType, lastModified: Date.now() });
}

export function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(objectUrl);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(createMediaError("This video has no readable duration."));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(createMediaError("This video could not be read."));
    };
    video.src = objectUrl;
  });
}

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (IMAGE_TYPES.has(file.type)) {
    if (file.size > MAX_IMAGE_SOURCE_BYTES) throw createMediaError("Choose an image smaller than 20 MB.");
    return { file: await compressImage(file), kind: "image", durationSeconds: null };
  }

  if (VIDEO_TYPES.has(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) throw createMediaError("Videos must be 50 MB or smaller.");
    const durationSeconds = await getVideoDuration(file);
    if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) throw createMediaError("Videos can be up to 30 seconds long.");
    return { file, kind: "video", durationSeconds };
  }

  throw createMediaError("Choose a JPG, PNG, WebP, MP4, or WebM file.");
}

export function formatMediaSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
