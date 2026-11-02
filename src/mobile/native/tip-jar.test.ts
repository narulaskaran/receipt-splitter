import { registerPlugin } from "@capacitor/core";

import { DEFAULT_TIP_PRODUCT_IDS } from "@/lib/tip-products";

import { TIP_PLUGIN_TIMEOUT_MS, createNativeTipJar } from "./tip-jar";

const mockGetProducts = jest.fn();
const mockPurchase = jest.fn();

jest.mock("@capacitor/core", () => ({
  registerPlugin: jest.fn(() => ({
    getProducts: (...args: unknown[]) => mockGetProducts(...args),
    purchase: (...args: unknown[]) => mockPurchase(...args),
  })),
}));

const registerArgs = [...(registerPlugin as jest.Mock).mock.calls];

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("TipJar plugin registration", () => {
  it("registers the native plugin as TipJar", () => {
    expect(registerArgs[0]).toEqual(["TipJar"]);
  });
});

describe("createNativeTipJar", () => {
  const ids = ["tip.small", "tip.large"];

  beforeEach(() => {
    mockGetProducts.mockReset();
    mockPurchase.mockReset();
  });

  it("returns products in the configured order and drops unknown ids", async () => {
    mockGetProducts.mockResolvedValue({
      products: [
        { id: "tip.other", displayName: "Other", displayPrice: "$9" },
        { id: "tip.large", displayName: "Large", displayPrice: "$5" },
        { id: "tip.small", displayName: "Small", displayPrice: "$1" },
        { id: "tip.large", displayName: "Large", displayPrice: "$5" },
      ],
    });

    const products = await createNativeTipJar(ids).loadProducts();

    expect(mockGetProducts).toHaveBeenCalledWith({ ids });
    expect(products).toEqual([
      { id: "tip.small", displayName: "Small", displayPrice: "$1" },
      { id: "tip.large", displayName: "Large", displayPrice: "$5" },
    ]);
  });

  it("returns an empty list when the plugin fails", async () => {
    mockGetProducts.mockRejectedValue(new Error("store down"));
    await expect(createNativeTipJar(ids).loadProducts()).resolves.toEqual([]);
  });

  it("returns an empty list when loading times out", async () => {
    jest.useFakeTimers();
    mockGetProducts.mockReturnValue(new Promise(() => {}));
    const pending = createNativeTipJar(ids).loadProducts();
    await jest.advanceTimersByTimeAsync(TIP_PLUGIN_TIMEOUT_MS);
    await expect(pending).resolves.toEqual([]);
    jest.useRealTimers();
  });

  it("passes a verified purchase through", async () => {
    mockPurchase.mockResolvedValue({ status: "success" });
    await expect(createNativeTipJar(ids).purchase("tip.small")).resolves.toEqual({ status: "success" });
    expect(mockPurchase).toHaveBeenCalledWith({ id: "tip.small" });
  });

  it("passes pending and cancelled through", async () => {
    const jar = createNativeTipJar(ids);
    mockPurchase.mockResolvedValueOnce({ status: "pending" });
    mockPurchase.mockResolvedValueOnce({ status: "cancelled" });
    await expect(jar.purchase("tip.small")).resolves.toEqual({ status: "pending" });
    await expect(jar.purchase("tip.small")).resolves.toEqual({ status: "cancelled" });
  });

  it("keeps a failed purchase message", async () => {
    mockPurchase.mockResolvedValue({ status: "failed", message: "unverified" });
    await expect(createNativeTipJar(ids).purchase("tip.small")).resolves.toEqual({
      status: "failed",
      message: "unverified",
    });
  });

  it("maps a plugin rejection to failed and does not throw", async () => {
    mockPurchase.mockRejectedValue(new Error("StoreKit failed"));
    await expect(createNativeTipJar(ids).purchase("tip.small")).resolves.toEqual({
      status: "failed",
      message: "StoreKit failed",
    });
  });

  it("maps an unimplemented plugin to unavailable", async () => {
    mockPurchase.mockRejectedValue(new Error("not implemented"));
    await expect(createNativeTipJar(ids).purchase("tip.small")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("maps a purchase timeout to unavailable", async () => {
    jest.useFakeTimers();
    mockPurchase.mockReturnValue(new Promise(() => {}));
    const pending = createNativeTipJar(ids).purchase("tip.small");
    await jest.advanceTimersByTimeAsync(TIP_PLUGIN_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ status: "unavailable" });
    jest.useRealTimers();
  });

  it("maps an unexpected payload to failed", async () => {
    mockPurchase.mockResolvedValue({ status: "mystery" });
    await expect(createNativeTipJar(ids).purchase("tip.small")).resolves.toEqual({
      status: "failed",
      message: "The tip didn't go through.",
    });
  });

  it("does not call the plugin for an id outside the configured list", async () => {
    await expect(createNativeTipJar(ids).purchase("tip.nope")).resolves.toEqual({
      status: "unavailable",
    });
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it("drops a product that has no localized price", async () => {
    mockGetProducts.mockResolvedValue({
      products: [{ id: "tip.small", displayName: "Small", displayPrice: "" }],
    });
    await expect(createNativeTipJar(ids).loadProducts()).resolves.toEqual([]);
  });

  it("uses the ids the caller passes, including the documented defaults", async () => {
    mockGetProducts.mockResolvedValue({ products: [] });
    await createNativeTipJar([...DEFAULT_TIP_PRODUCT_IDS]).loadProducts();
    expect(mockGetProducts).toHaveBeenCalledWith({ ids: [...DEFAULT_TIP_PRODUCT_IDS] });
  });

  it("resolves a hanging purchase only after the timeout, not before", async () => {
    jest.useFakeTimers();
    const gate = deferred<{ status: string }>();
    mockPurchase.mockReturnValue(gate.promise);
    const pending = createNativeTipJar(ids).purchase("tip.small");
    await jest.advanceTimersByTimeAsync(TIP_PLUGIN_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ status: "unavailable" });
    gate.resolve({ status: "success" });
    jest.useRealTimers();
  });
});
