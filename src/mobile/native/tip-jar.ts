import { registerPlugin } from "@capacitor/core";

import type { TipJar, TipProduct, TipPurchaseResult } from "@/lib/platform";

/** How long a StoreKit call may take before the UI treats it as unavailable. */
export const TIP_PLUGIN_TIMEOUT_MS = 10_000;

type NativeTipPurchaseResult = { status?: string; message?: string };

export interface TipJarPlugin {
  getProducts(options: { ids: string[] }): Promise<{ products?: TipProduct[] }>;
  purchase(options: { id: string }): Promise<NativeTipPurchaseResult>;
}

export const TipJarNative = registerPlugin<TipJarPlugin>("TipJar");

class TipTimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "TipTimeoutError";
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TipTimeoutError()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const FAILED_MESSAGE = "The tip didn't go through.";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : FAILED_MESSAGE;
}

function isUnavailableError(error: unknown): boolean {
  return /unavailable|not implemented|unimplemented/i.test(errorMessage(error));
}

function normalizePurchase(result: NativeTipPurchaseResult | null | undefined): TipPurchaseResult {
  const status = result?.status;
  if (status === "success" || status === "pending" || status === "cancelled" || status === "unavailable") {
    return { status };
  }
  return { status: "failed", message: (status === "failed" && result?.message) || FAILED_MESSAGE };
}

/**
 * `productIds` is the configured list (the caller reads
 * `import.meta.env.VITE_TIP_PRODUCT_IDS` and passes the parsed ids).
 * Plugin failures and the timeout become an empty catalog or a failed /
 * unavailable purchase. This function does not throw into the UI.
 */
export function createNativeTipJar(allowed: readonly string[]): TipJar {
  return {
    async loadProducts(): Promise<TipProduct[]> {
      try {
        const result = await withTimeout(
          TipJarNative.getProducts({ ids: [...allowed] }),
          TIP_PLUGIN_TIMEOUT_MS,
        );
        const byId = new Map(
          (result?.products ?? [])
            .filter((product) => product && allowed.includes(product.id))
            .map((product) => [product.id, product]),
        );
        return allowed.flatMap((id) => {
          const product = byId.get(id);
          if (!product?.displayName || !product.displayPrice) return [];
          const { displayName, displayPrice } = product;
          return [{ id, displayName, displayPrice }];
        });
      } catch {
        return [];
      }
    },

    async purchase(productId: string): Promise<TipPurchaseResult> {
      if (!allowed.includes(productId)) return { status: "unavailable" };
      try {
        const result = await withTimeout(
          TipJarNative.purchase({ id: productId }),
          TIP_PLUGIN_TIMEOUT_MS,
        );
        return normalizePurchase(result);
      } catch (error) {
        if (error instanceof TipTimeoutError || isUnavailableError(error)) {
          return { status: "unavailable" };
        }
        return { status: "failed", message: errorMessage(error) };
      }
    },
  };
}
