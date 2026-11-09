import { safeGetItem, safeSetItem } from "./storage";

const SESSION_KEY = "receiptSplitterSessionId";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Accepts client session ids; replaces values that are unsafe in paths or webhooks. */
export function sanitizeSessionId(raw: FormDataEntryValue | null): string {
  if (typeof raw === "string" && SESSION_ID_PATTERN.test(raw)) {
    return raw;
  }
  return crypto.randomUUID();
}

export function getSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = safeGetItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  safeSetItem(SESSION_KEY, id);
  return id;
}
