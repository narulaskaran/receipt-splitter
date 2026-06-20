/**
 * Safe localStorage wrapper that handles QuotaExceededError.
 * Returns true on success, false on failure (logs the error to console).
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn("localStorage.setItem failed:", err);
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
