const SESSION_KEY = "receiptSplitterSessionId";

export function getSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}
