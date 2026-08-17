import { type StoredReceipt } from "@/types";

export const UNTITLED_RECEIPT_NAME = "Untitled receipt";

export function receiptRestaurantName(stored: StoredReceipt): string {
  const name = stored.receipt.restaurant?.trim();
  return name ? name : UNTITLED_RECEIPT_NAME;
}

function sameRestaurantReceipts(
  stored: StoredReceipt,
  receipts: StoredReceipt[]
): StoredReceipt[] {
  const name = receiptRestaurantName(stored);
  return receipts.filter((r) => receiptRestaurantName(r) === name);
}

/** 1-based index among same-name receipts, or null when the name is unique. */
export function receiptCollisionNumber(
  stored: StoredReceipt,
  receipts: StoredReceipt[]
): number | null {
  const same = sameRestaurantReceipts(stored, receipts);
  if (same.length <= 1) return null;
  return same.findIndex((r) => r.id === stored.id) + 1;
}

/**
 * Card subtitle: always the date when present; append #n only when names collide.
 * Examples: "2024-01-01", "#2", "2024-01-01 · #2"
 */
export function receiptSubtitle(
  stored: StoredReceipt,
  receipts: StoredReceipt[]
): string | undefined {
  const parts: string[] = [];
  if (stored.receipt.date) parts.push(stored.receipt.date);
  const n = receiptCollisionNumber(stored, receipts);
  if (n != null) parts.push(`#${n}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Combined label for lists, toasts, results, and copy.
 * Unique names stay as the restaurant. Collisions add date (when present) and #n.
 * Examples: "Starbucks", "Starbucks · #2", "Starbucks · 2024-01-01 · #2"
 */
export function receiptDisplayName(
  stored: StoredReceipt,
  receipts: StoredReceipt[]
): string {
  const name = receiptRestaurantName(stored);
  if (receiptCollisionNumber(stored, receipts) == null) return name;
  const extra = receiptSubtitle(stored, receipts);
  return extra ? `${name} · ${extra}` : name;
}
