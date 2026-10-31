import { safeGetItem, safeSetItem } from "./storage";

const SESSION_KEY = "receiptSplitterSessionId";

export function getSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = safeGetItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  safeSetItem(SESSION_KEY, id);
  return id;
}
