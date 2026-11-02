export const RECEIPT_IMAGE_STORAGE_KEY = "receiptSplitterImage";

/** Keys with this prefix are copied to the native Preferences mirror when one is installed. */
export const STORAGE_MIRROR_PREFIX = "receiptSplitter";

/**
 * iOS UserDefaults (what Capacitor Preferences uses) is not a blob store.
 * Values larger than this are kept in localStorage only. A full thumbnail map
 * stays well under the cap; a legacy full-size receipt image does not.
 */
export const MAX_PREFERENCES_VALUE_LENGTH = 1_000_000;

/**
 * Optional write-through used by the iOS shell so the WebView's localStorage
 * can be rebuilt if iOS evicts it. Web never installs one. `set` / `remove`
 * run after the localStorage attempt, including when that attempt throws.
 */
export interface StorageMirror {
  set(key: string, value: string): void;
  remove(key: string): void;
}

let storageMirror: StorageMirror | null = null;
let durableStorageNoticePending = false;

const DURABLE_STORAGE_NOTICE =
  "Backup storage on this device is unavailable. This session still uses on-device storage.";

export function setStorageMirror(mirror: StorageMirror | null): void {
  storageMirror = mirror;
}

export function isMirroredDataKey(key: string): boolean {
  return key.startsWith(STORAGE_MIRROR_PREFIX);
}

/**
 * One-time, non-blocking signal that Preferences could not be used.
 * Boot logs immediately; the shell shows the message after the first paint.
 */
export function reportDurableStorageUnavailable(detail?: unknown): void {
  console.warn(
    "Durable storage is unavailable; continuing with on-device storage only.",
    detail ?? "",
  );
  durableStorageNoticePending = true;
}

export function consumeDurableStorageNotice(): string | null {
  if (!durableStorageNoticePending) return null;
  durableStorageNoticePending = false;
  return DURABLE_STORAGE_NOTICE;
}

function notifyMirror(key: string, op: "set" | "remove", value?: string): void {
  if (!storageMirror || !isMirroredDataKey(key)) return;
  try {
    if (op === "set") storageMirror.set(key, value ?? "");
    else storageMirror.remove(key);
  } catch (err) {
    console.warn(`Storage mirror ${op} failed for key "${key}"`, err);
  }
}

/**
 * Safe localStorage wrapper that handles QuotaExceededError.
 * Returns true on success, false on failure (logs the error to console).
 *
 * Real-world localStorage limits:
 *   - iOS Safari:           5 MB (smallest in common use)
 *   - Safari (desktop):     5 MB (some newer versions up to 10 MB)
 *   - Chrome (desktop):    10 MB
 *   - Firefox:             10 MB
 *   - Chrome Android:      10 MB (varies by device RAM)
 *   - Samsung Internet:    10 MB
 *
 * This app's main consumer is the cached receipt image stored as a base64
 * data URL. With a 4 MB compression target, the base64-encoded string is
 * ~5.3 MB (33% overhead), which can exceed the 5 MB limit on Safari.
 * The safeSetItem wrapper catches that case and the caller can fall back
 * to evicting the image cache.
 */
export function safeSetItem(key: string, value: string): boolean {
  let stored = true;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    stored = false;
    const usage = measureStorageUsage();
    console.warn(
      `localStorage.setItem failed for key "${key}"` +
        ` (current usage: ~${formatBytes(usage)})`,
      err,
    );
  }
  notifyMirror(key, "set", value);
  return stored;
}

/**
 * Safe localStorage.getItem wrapper.
 * Returns null on any error, or the stored value on success.
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRemoveItem(key: string): boolean {
  let removed = true;
  try {
    localStorage.removeItem(key);
  } catch {
    removed = false;
  }
  notifyMirror(key, "remove");
  return removed;
}

/**
 * Remove on-device split data: session, thumbnails, legacy image, AI consent,
 * and the anonymous session id. Theme is left alone. Removals go through the
 * mirror too, so a later boot cannot restore what was cleared.
 */
export function clearAllLocalData(): void {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isMirroredDataKey(key)) keys.push(key);
    }
  } catch (error) {
    console.warn("Could not list local data to clear", error);
  }
  for (const key of keys) safeRemoveItem(key);
}

/**
 * Returns the approximate total bytes used by all keys and values in
 * localStorage. Each character is counted as 2 bytes (UTF-16), which
 * matches the ECMAScript specification for string storage and is the
 * metric browsers use for quota accounting.
 *
 * Use this to get a rough picture of storage pressure — for example, to
 * decide whether to pre-emptively evict the cached receipt image.
 */
export function measureStorageUsage(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Each JS string character is 2 bytes (UTF-16)
        total += key.length * 2;
        const value = localStorage.getItem(key);
        if (value) {
          total += value.length * 2;
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Format a byte count to a human-readable string (B, KB, or MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
