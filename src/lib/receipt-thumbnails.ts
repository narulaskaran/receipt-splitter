import { RECEIPT_IMAGE_STORAGE_KEY, safeGetItem, safeRemoveItem, safeSetItem } from "./storage";

/**
 * Per-receipt preview thumbnails, persisted as ONE JSON map under a single
 * localStorage key (`Record<receiptId, dataUrl>`).
 *
 * Thumbnails are small (~a few KB each, capped by MAX_THUMBNAIL_* below), so
 * even a full session of MAX_RECEIPTS_PER_SESSION receipts costs tens of KB —
 * unlike the legacy singular `receiptSplitterImage` key, which held a
 * full-size ~5 MB data URL. Object key insertion order is preserved by
 * JSON round-trips, so the last inserted entry is the most recently accepted
 * receipt (used to restore the dropzone preview).
 */
export const RECEIPT_THUMBNAILS_STORAGE_KEY = "receiptSplitterThumbnails";

export type ReceiptThumbnailMap = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read the whole thumbnail map. Returns {} on absence or any corruption. */
export function getThumbnails(): ReceiptThumbnailMap {
  const raw = safeGetItem(RECEIPT_THUMBNAILS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const result: ReceiptThumbnailMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        result[id] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Store (or replace) the thumbnail for one receipt. Re-inserting an existing
 * id moves it to the end so it counts as the most recent.
 * Returns true when the updated map was persisted.
 */
export function setThumbnail(receiptId: string, dataUrl: string): boolean {
  if (!receiptId || !dataUrl.startsWith("data:image/")) return false;
  const thumbnails = getThumbnails();
  delete thumbnails[receiptId];
  thumbnails[receiptId] = dataUrl;
  return safeSetItem(
    RECEIPT_THUMBNAILS_STORAGE_KEY,
    JSON.stringify(thumbnails)
  );
}

/** Drop one receipt's thumbnail. No-op when absent. */
export function removeThumbnail(receiptId: string): void {
  const thumbnails = getThumbnails();
  if (!(receiptId in thumbnails)) return;
  delete thumbnails[receiptId];
  safeSetItem(RECEIPT_THUMBNAILS_STORAGE_KEY, JSON.stringify(thumbnails));
}

/** Remove every thumbnail (used by New Split). */
export function clearThumbnails(): void {
  safeRemoveItem(RECEIPT_THUMBNAILS_STORAGE_KEY);
}

/** Id of the most recently stored thumbnail, or null when the map is empty. */
export function getLatestThumbnailId(): string | null {
  const ids = Object.keys(getThumbnails());
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

/**
 * Delete thumbnails whose receipt id is no longer in the session (e.g. stale
 * entries left behind by a corrupted or rolled-back session blob).
 */
export function pruneThumbnails(knownReceiptIds: readonly string[]): void {
  const known = new Set(knownReceiptIds);
  const thumbnails = getThumbnails();
  const stale = Object.keys(thumbnails).filter((id) => !known.has(id));
  if (stale.length === 0) return;
  for (const id of stale) {
    delete thumbnails[id];
  }
  safeSetItem(RECEIPT_THUMBNAILS_STORAGE_KEY, JSON.stringify(thumbnails));
}

/**
 * One-time migration from the legacy singular image key: best-effort attach
 * the old full-size data URL to the newest receipt, then always remove the
 * legacy key. Returns the id it was attached to, or null.
 */
export function migrateLegacyImage(
  newestReceiptId?: string | null
): string | null {
  const legacy = safeGetItem(RECEIPT_IMAGE_STORAGE_KEY);
  if (!legacy) return null;

  let attachedTo: string | null = null;
  if (
    newestReceiptId &&
    legacy.startsWith("data:image/") &&
    setThumbnail(newestReceiptId, legacy)
  ) {
    attachedTo = newestReceiptId;
  }
  safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
  return attachedTo;
}
