export const RECEIPT_IMAGE_STORAGE_KEY = "receiptSplitterImage";

/** Keys with this prefix are copied to the native Preferences mirror when one is installed. */
export const STORAGE_MIRROR_PREFIX = "receiptSplitter";

/**
 * Optional write-through used by the iOS shell. Web never installs one.
 * `set` / `remove` run after the localStorage attempt, including when that
 * attempt throws, so Preferences can keep a copy the WebView evicted.
 */
export interface StorageMirror {
  set(key: string, value: string): void;
  remove(key: string): void;
}

let storageMirror: StorageMirror | null = null;

export function setStorageMirror(mirror: StorageMirror | null): void {
  storageMirror = mirror;
}

function notifyMirror(key: string, op: "set" | "remove", value?: string): void {
  if (!storageMirror || !key.startsWith(STORAGE_MIRROR_PREFIX)) return;
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
  let stored = false;
  try {
    localStorage.setItem(key, value);
    stored = true;
  } catch (err) {
    const usage = measureStorageUsage();
    console.warn(
      `localStorage.setItem failed for key "${key}"` +
        ` (current usage: ~${formatBytes(usage)})`,
      err,
    );
    stored = false;
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
  let removed = false;
  try {
    localStorage.removeItem(key);
    removed = true;
  } catch {
    removed = false;
  }
  notifyMirror(key, "remove");
  return removed;
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
