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
 * receipt. Each thumbnail is shown in that receipt's details card.
 *
 * The in-memory snapshot is the live source for React via
 * `subscribeThumbnails` / `getThumbnails`. Mutators write localStorage then
 * notify subscribers so a persist that finishes after the receipts prop
 * updates still paints without re-parsing storage on unrelated re-renders.
 */
export const RECEIPT_THUMBNAILS_STORAGE_KEY = "receiptSplitterThumbnails";

export type ReceiptThumbnailMap = Record<string, string>;

/** Stable empty map for `useSyncExternalStore`'s server snapshot. */
export const EMPTY_THUMBNAILS: ReceiptThumbnailMap = Object.freeze({});

const listeners = new Set<() => void>();

let hydrated = false;
let snapshot: ReceiptThumbnailMap = EMPTY_THUMBNAILS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emitThumbnailsChanged(): void {
  listeners.forEach((listener) => listener());
}

function readMapFromStorage(): ReceiptThumbnailMap {
  const raw = safeGetItem(RECEIPT_THUMBNAILS_STORAGE_KEY);
  if (!raw) return EMPTY_THUMBNAILS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_THUMBNAILS;
    const result: ReceiptThumbnailMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        result[id] = value;
      }
    }
    return Object.keys(result).length === 0 ? EMPTY_THUMBNAILS : result;
  } catch {
    return EMPTY_THUMBNAILS;
  }
}

function hydrateFromStorage(): void {
  if (hydrated) return;
  snapshot = readMapFromStorage();
  hydrated = true;
}

function persistAndEmit(next: ReceiptThumbnailMap): boolean {
  const empty = Object.keys(next).length === 0;
  const ok = empty
    ? safeRemoveItem(RECEIPT_THUMBNAILS_STORAGE_KEY)
    : safeSetItem(RECEIPT_THUMBNAILS_STORAGE_KEY, JSON.stringify(next));
  if (!ok) return false;
  snapshot = empty ? EMPTY_THUMBNAILS : next;
  hydrated = true;
  emitThumbnailsChanged();
  return true;
}

/**
 * Subscribe to thumbnail writes. `useSyncExternalStore` should pass this as
 * `subscribe` and `getThumbnails` as `getSnapshot`.
 */
export function subscribeThumbnails(onStoreChange: () => void): () => void {
  hydrateFromStorage();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * Discard the in-memory snapshot so the next read hydrates from localStorage.
 * Used by tests after `localStorage.clear()`.
 */
export function resetThumbnailsStore(): void {
  hydrated = false;
  snapshot = EMPTY_THUMBNAILS;
  listeners.clear();
}

/** Read the whole thumbnail map. Returns {} on absence or any corruption. */
export function getThumbnails(): ReceiptThumbnailMap {
  hydrateFromStorage();
  return snapshot;
}

/**
 * Store (or replace) the thumbnail for one receipt. Re-inserting an existing
 * id moves it to the end so it counts as the most recent.
 * Returns true when the updated map was persisted.
 */
export function setThumbnail(receiptId: string, dataUrl: string): boolean {
  if (!receiptId || !dataUrl.startsWith("data:image/")) return false;
  const thumbnails: ReceiptThumbnailMap = { ...getThumbnails() };
  delete thumbnails[receiptId];
  thumbnails[receiptId] = dataUrl;
  return persistAndEmit(thumbnails);
}

/** Drop one receipt's thumbnail. No-op when absent. */
export function removeThumbnail(receiptId: string): void {
  const thumbnails = getThumbnails();
  if (!(receiptId in thumbnails)) return;
  const next: ReceiptThumbnailMap = { ...thumbnails };
  delete next[receiptId];
  persistAndEmit(next);
}

/** Remove every thumbnail (used by New Split). */
export function clearThumbnails(): void {
  persistAndEmit(EMPTY_THUMBNAILS);
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
  const next: ReceiptThumbnailMap = { ...thumbnails };
  for (const id of stale) {
    delete next[id];
  }
  persistAndEmit(next);
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
