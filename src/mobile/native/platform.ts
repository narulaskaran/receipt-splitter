import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import {
  Camera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";

import { parseTipProductIds } from "@/lib/tip-products";
import {
  PlatformPermissionError,
  type OpenUrlOutcome,
  type PlatformAdapter,
  type ShareOutcome,
} from "@/lib/platform";

import { createNativeTipJar } from "./tip-jar";

/**
 * Installed `@capacitor/app` 8.1.2 does not declare these methods (they live
 * on `@capacitor/app-launcher`). The native-bridge brief calls them on App.
 * A missing implementation rejects and becomes "unavailable".
 */
interface AppUrlOpener {
  canOpenUrl(options: { url: string }): Promise<{ value: boolean }>;
  openUrl(options: { url: string }): Promise<{ completed: boolean }>;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isCancellation(error: unknown): boolean {
  return /cancel/i.test(errorText(error));
}

function isPermissionDenial(error: unknown): boolean {
  return /denied|permission|restricted/i.test(errorText(error));
}

function permissionError(kind: "camera" | "photos"): PlatformPermissionError {
  const which = kind === "camera" ? "camera" : "photos";
  return new PlatformPermissionError(
    `Receipt Splitter can't use the ${which}. Enable access in Settings > Receipt Splitter.`,
    kind,
  );
}

interface ImageFileType {
  type: string;
  ext: string;
}

/** The camera plugin converts HEIC/HEIF to JPEG; still map those types. */
export function imageFileType(format: string | undefined, blobType: string): ImageFileType {
  const hint = `${format ?? ""} ${blobType}`.toLowerCase();
  if (/\bhei[cf]\b|image\/hei[cf]/.test(hint)) {
    return { type: "image/jpeg", ext: "jpg" };
  }
  if (hint.includes("png")) return { type: "image/png", ext: "png" };
  if (hint.includes("webp")) return { type: "image/webp", ext: "webp" };
  if (hint.includes("gif")) return { type: "image/gif", ext: "gif" };
  return { type: "image/jpeg", ext: "jpg" };
}

async function fileFromWebPath(webPath: string, format: string | undefined, filename: string): Promise<File> {
  const response = await fetch(webPath);
  if (!response.ok || typeof response.blob !== "function") {
    throw new Error("Could not read the photo");
  }
  const blob = await response.blob();
  const { type, ext } = imageFileType(format, blob.type);
  const name = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  return new File([blob], name, { type });
}

async function captureReceiptPhoto(): Promise<File | null> {
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: 85,
      correctOrientation: true,
      saveToGallery: false,
    });
    if (!photo.webPath) {
      throw new Error("Could not read the photo");
    }
    return await fileFromWebPath(photo.webPath, photo.format, "receipt");
  } catch (error) {
    if (isCancellation(error)) return null;
    if (isPermissionDenial(error)) throw permissionError("camera");
    throw error;
  }
}

async function pickReceiptPhotos(limit: number): Promise<File[]> {
  try {
    const gallery = await Camera.pickImages({
      limit,
      quality: 85,
      correctOrientation: true,
    });
    const photos = gallery.photos ?? [];
    const files = await Promise.all(
      photos.map((photo, index) => {
        if (!photo.webPath) {
          throw new Error("Could not read the photo");
        }
        return fileFromWebPath(photo.webPath, photo.format, `receipt-${index + 1}`);
      }),
    );
    return files;
  } catch (error) {
    if (isCancellation(error)) return [];
    if (isPermissionDenial(error)) throw permissionError("photos");
    throw error;
  }
}

async function shareText(content: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<ShareOutcome> {
  try {
    const can = await Share.canShare();
    if (!can.value) return "unsupported";
    await Share.share(content);
    return "shared";
  } catch (error) {
    if (isCancellation(error)) return "cancelled";
    return "unsupported";
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.write({ string: text });
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

async function readClipboardText(): Promise<string | null> {
  try {
    const result = await Clipboard.read();
    return result.value ?? null;
  } catch {
    return null;
  }
}

async function openCustomScheme(url: string): Promise<OpenUrlOutcome> {
  const opener = App as unknown as AppUrlOpener;
  const can = await opener.canOpenUrl({ url });
  if (!can?.value) return "unavailable";
  const opened = await opener.openUrl({ url });
  return opened?.completed ? "opened" : "unavailable";
}

async function openExternalUrl(url: string): Promise<OpenUrlOutcome> {
  try {
    if (/^https?:\/\//i.test(url)) {
      await Browser.open({ url });
      return "opened";
    }
    // Custom schemes such as venmo://. javascript: and data: have no "//".
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      return await openCustomScheme(url);
    }
    return "unavailable";
  } catch (error) {
    console.error("Failed to open URL:", error);
    return "unavailable";
  }
}

function tipProductIdsFromEnv(): string[] {
  const env = (import.meta as ImportMeta & { env?: { VITE_TIP_PRODUCT_IDS?: string } }).env;
  return parseTipProductIds(env?.VITE_TIP_PRODUCT_IDS);
}

export function createNativePlatform(): PlatformAdapter {
  return {
    kind: "ios",
    isNative: true,
    showKofi: false,
    tips: createNativeTipJar(tipProductIdsFromEnv()),
    captureReceiptPhoto,
    pickReceiptPhotos,
    shareText,
    copyText,
    readClipboardText,
    openExternalUrl,
  };
}
