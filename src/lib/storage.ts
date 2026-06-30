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
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    const usage = measureStorageUsage();
    console.warn(
      `localStorage.setItem failed for key "${key}"` +
        ` (current usage: ~${formatBytes(usage)})`,
      err,
    );
    return false;
  }
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
}

/**
 * Format a byte count to a human-readable string (B, KB, or MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
