import { safeGetItem, safeSetItem } from "@/lib/storage";

/** Bump when the processor or what we send changes, so people are asked again. */
export const CONSENT_VERSION = 1;

export const AI_CONSENT_STORAGE_KEY = "receiptSplitterAiConsent";

interface StoredConsent {
  version: number;
}

function readStoredConsent(): StoredConsent | null {
  const raw = safeGetItem(AI_CONSENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (typeof parsed.version !== "number" || !Number.isInteger(parsed.version)) {
      return null;
    }
    return { version: parsed.version };
  } catch {
    return null;
  }
}

/** True when the stored acceptance covers the current consent version. */
export function hasAiConsent(): boolean {
  const stored = readStoredConsent();
  return stored !== null && stored.version >= CONSENT_VERSION;
}

export function acceptAiConsent(): boolean {
  return safeSetItem(
    AI_CONSENT_STORAGE_KEY,
    JSON.stringify({ version: CONSENT_VERSION } satisfies StoredConsent)
  );
}
