// Contract between the shared React UI and the host platform (browser or the
// Capacitor iOS shell). Shared code imports only from "@/lib/platform"; the
// native implementation lives in src/mobile/native/ so Capacitor plugins never
// enter the Next.js bundle.

import type { PlatformKind } from "@/lib/app-config";

export type { PlatformKind };

/** The user denied (or cannot grant) camera/photo access. `message` is user-facing. */
export class PlatformPermissionError extends Error {
  constructor(
    message: string,
    readonly kind: "camera" | "photos"
  ) {
    super(message);
    this.name = "PlatformPermissionError";
  }
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported";
export type OpenUrlOutcome = "opened" | "unavailable";

export interface TipProduct {
  /** App Store Connect product ID (see src/lib/tip-products.ts). */
  id: string;
  displayName: string;
  /** Localized by StoreKit, e.g. "€1,99". Never format prices ourselves. */
  displayPrice: string;
}

export type TipPurchaseResult =
  | { status: "success" }
  | { status: "pending" } // Ask to Buy / SCA: completes later
  | { status: "cancelled" }
  | { status: "failed"; message: string }
  | { status: "unavailable" };

export interface TipJar {
  /** Products that exist in the store right now (empty when not configured or offline). */
  loadProducts(): Promise<TipProduct[]>;
  /** Consumable, repeatable purchase. Resolves after the transaction is verified and finished. */
  purchase(productId: string): Promise<TipPurchaseResult>;
}

export interface PlatformAdapter {
  kind: PlatformKind;
  isNative: boolean;

  /** Take a receipt photo. `null` = the user cancelled. Throws PlatformPermissionError when denied. */
  captureReceiptPhoto?(): Promise<File | null>;
  /** Choose up to `limit` receipt photos from the library. `[]` = cancelled. Throws PlatformPermissionError when denied. */
  pickReceiptPhotos?(limit: number): Promise<File[]>;

  shareText(content: { title?: string; text?: string; url?: string }): Promise<ShareOutcome>;
  copyText(text: string): Promise<boolean>;
  /** Clipboard text, or null when blocked/unavailable (the UI falls back to a field). */
  readClipboardText(): Promise<string | null>;
  /**
   * Open an https link in the browser, or a custom-scheme link (venmo://) in
   * its app. "unavailable" = nothing handles it (e.g. Venmo not installed).
   */
  openExternalUrl(url: string): Promise<OpenUrlOutcome>;

  /** Present on native only; web shows the Ko-fi link instead. */
  tips: TipJar | null;
  /** True where the Ko-fi link may be shown (web). Never on iOS (App Store 3.1.1). */
  showKofi: boolean;
}
