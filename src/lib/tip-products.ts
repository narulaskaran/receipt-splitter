// Consumable tip products (iOS StoreKit). The IDs must be created in App Store
// Connect as *consumable* in-app purchases; see docs/ios/tips.md. They can be
// replaced at build time with VITE_TIP_PRODUCT_IDS (comma-separated) without a
// code change. Order = display order.

export const DEFAULT_TIP_PRODUCT_IDS = [
  "app.receiptsplitter.ios.tip.small",
  "app.receiptsplitter.ios.tip.medium",
  "app.receiptsplitter.ios.tip.large",
] as const;

export function parseTipProductIds(raw: string | undefined | null): string[] {
  const ids = (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9._-]{1,200}$/.test(id));
  return ids.length > 0 ? Array.from(new Set(ids)) : [...DEFAULT_TIP_PRODUCT_IDS];
}
