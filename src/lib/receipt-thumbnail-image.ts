import imageCompression from "browser-image-compression";
import {
  setThumbnail,
  getThumbnails,
  removeThumbnail,
} from "@/lib/receipt-thumbnails";

/** Max thumbnail edge in px. Small enough to be a few KB as a JPEG. */
const THUMB_MAX_EDGE = 200;
/** Hard size cap (bytes) for the encoded thumbnail data URL. */
export const THUMBNAIL_MAX_BYTES = 50 * 1024;

/**
 * Compress an image File into a small data-URL thumbnail suitable for
 * localStorage persistence (~a few KB). Returns null on any failure or when
 * the result still exceeds THUMBNAIL_MAX_BYTES — thumbnails are best-effort.
 */
export async function createReceiptThumbnail(
  file: File,
  maxBytes: number = THUMBNAIL_MAX_BYTES
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const blob = await imageCompression(file, {
      maxSizeMB: maxBytes / (1024 * 1024),
      maxWidthOrHeight: THUMB_MAX_EDGE,
      useWebWorker: true,
    });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Failed to read thumbnail"));
      reader.onerror = () =>
        reject(reader.error ?? new Error("Failed to read thumbnail"));
      reader.readAsDataURL(blob);
    });
    if (!dataUrl.startsWith("data:image/") || dataUrl.length * 2 > maxBytes) {
      return null;
    }
    return dataUrl;
  } catch (error) {
    console.warn("Thumbnail generation failed:", error);
    return null;
  }
}

/**
 * Persist one receipt's thumbnail under its receipt id, evicting other
 * thumbnails when quota is exceeded so the newest receipt always wins.
 */
export function persistReceiptThumbnail(
  receiptId: string,
  dataUrl: string
): boolean {
  if (setThumbnail(receiptId, dataUrl)) return true;
  // Quota (or another write failure): drop older thumbnails to make room,
  // never the entry we are about to write.
  const existing = getThumbnails();
  for (const id of Object.keys(existing)) {
    if (id === receiptId) continue;
    removeThumbnail(id);
    if (setThumbnail(receiptId, dataUrl)) return true;
  }
  return false;
}
