import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";

import { PlatformPermissionError, getPlatform, setPlatform, webPlatform } from "@/lib/platform";
import { DEFAULT_TIP_PRODUCT_IDS } from "@/lib/tip-products";

import { createNativePlatform } from "./platform";

const mockGetProducts = jest.fn();
const mockPurchase = jest.fn();

jest.mock("@capacitor/core", () => ({
  registerPlugin: jest.fn(() => ({
    getProducts: (...args: unknown[]) => mockGetProducts(...args),
    purchase: (...args: unknown[]) => mockPurchase(...args),
  })),
}));

jest.mock("@capacitor/camera", () => ({
  Camera: {
    getPhoto: jest.fn(),
    pickImages: jest.fn(),
  },
  CameraSource: { Camera: "CAMERA", Photos: "PHOTOS", Prompt: "PROMPT" },
  CameraResultType: { Uri: "uri", Base64: "base64", DataUrl: "dataUrl" },
}));

jest.mock("@capacitor/share", () => ({
  Share: {
    canShare: jest.fn(),
    share: jest.fn(),
  },
}));

jest.mock("@capacitor/clipboard", () => ({
  Clipboard: {
    write: jest.fn(),
    read: jest.fn(),
  },
}));

jest.mock("@capacitor/browser", () => ({
  Browser: {
    open: jest.fn(),
  },
}));

jest.mock("@capacitor/app", () => ({
  App: {
    canOpenUrl: jest.fn(),
    openUrl: jest.fn(),
    addListener: jest.fn(),
  },
}));

// `@capacitor/app` 8.1.2's types omit canOpenUrl/openUrl. The mock provides them.
const AppUrls = App as typeof App & {
  canOpenUrl: jest.Mock;
  openUrl: jest.Mock;
};

const originalFetch = global.fetch;

function jpegResponse(type = "image/jpeg") {
  return {
    ok: true,
    blob: async () => new Blob([Uint8Array.from([1, 2, 3])], { type }),
  } as Response;
}

describe("createNativePlatform", () => {
  const platform = createNativePlatform();

  beforeEach(() => {
    mockGetProducts.mockReset();
    mockPurchase.mockReset();
    (Camera.getPhoto as jest.Mock).mockReset();
    (Camera.pickImages as jest.Mock).mockReset();
    (Share.canShare as jest.Mock).mockReset();
    (Share.share as jest.Mock).mockReset();
    (Clipboard.write as jest.Mock).mockReset();
    (Clipboard.read as jest.Mock).mockReset();
    (Browser.open as jest.Mock).mockReset();
    AppUrls.canOpenUrl.mockReset();
    AppUrls.openUrl.mockReset();
    global.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setPlatform(webPlatform);
  });

  it("is the iOS adapter with tips and without Ko-fi", () => {
    expect(platform.kind).toBe("ios");
    expect(platform.isNative).toBe(true);
    expect(platform.showKofi).toBe(false);
    expect(platform.tips).not.toBeNull();
    expect(platform.captureReceiptPhoto).toEqual(expect.any(Function));
    expect(platform.pickReceiptPhotos).toEqual(expect.any(Function));
  });

  it("asks StoreKit for the configured tip ids", async () => {
    mockGetProducts.mockResolvedValue({ products: [] });
    await platform.tips?.loadProducts();
    expect(mockGetProducts).toHaveBeenCalledWith({ ids: [...DEFAULT_TIP_PRODUCT_IDS] });
  });

  it("takes a camera photo and turns the webPath into a jpeg File", async () => {
    (Camera.getPhoto as jest.Mock).mockResolvedValue({
      webPath: "capacitor://localhost/photo",
      format: "jpeg",
      saved: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue(jpegResponse());

    const file = await platform.captureReceiptPhoto?.();

    expect(Camera.getPhoto).toHaveBeenCalledWith({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: 85,
      correctOrientation: true,
      saveToGallery: false,
    });
    expect(global.fetch).toHaveBeenCalledWith("capacitor://localhost/photo");
    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe("receipt.jpg");
    expect(file?.type).toBe("image/jpeg");
  });

  it("maps a HEIC capture to a jpeg file", async () => {
    (Camera.getPhoto as jest.Mock).mockResolvedValue({
      webPath: "capacitor://localhost/heic",
      format: "heic",
      saved: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue(jpegResponse("image/heic"));

    const file = await platform.captureReceiptPhoto?.();

    expect(file?.type).toBe("image/jpeg");
    expect(file?.name).toBe("receipt.jpg");
  });

  it("maps a HEIF blob type even when the plugin reports jpeg", async () => {
    (Camera.getPhoto as jest.Mock).mockResolvedValue({
      webPath: "capacitor://localhost/heif",
      format: "jpeg",
      saved: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue(jpegResponse("image/heif"));

    const file = await platform.captureReceiptPhoto?.();
    expect(file?.type).toBe("image/jpeg");
  });

  it("returns null when the user cancels the camera", async () => {
    (Camera.getPhoto as jest.Mock).mockRejectedValue(new Error("User cancelled photos app"));
    await expect(platform.captureReceiptPhoto?.()).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws PlatformPermissionError when camera access is denied", async () => {
    (Camera.getPhoto as jest.Mock).mockRejectedValue(new Error("User denied access to camera"));
    await expect(platform.captureReceiptPhoto?.()).rejects.toBeInstanceOf(PlatformPermissionError);
    await expect(platform.captureReceiptPhoto?.()).rejects.toMatchObject({
      kind: "camera",
      message: expect.stringContaining("Settings > Receipt Splitter"),
    });
  });

  it("rethrows camera failures that are not cancellation or denial", async () => {
    (Camera.getPhoto as jest.Mock).mockRejectedValue(
      new Error("Camera not available while running in Simulator"),
    );
    await expect(platform.captureReceiptPhoto?.()).rejects.toThrow(/Simulator/);
  });

  it("picks library photos up to the limit and names them in order", async () => {
    (Camera.pickImages as jest.Mock).mockResolvedValue({
      photos: [
        { webPath: "capacitor://localhost/a", format: "png" },
        { webPath: "capacitor://localhost/b", format: "webp" },
      ],
    });
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith("/a")) return jpegResponse("image/png");
      return jpegResponse("image/webp");
    });

    const files = await platform.pickReceiptPhotos?.(3);

    expect(Camera.pickImages).toHaveBeenCalledWith({
      limit: 3,
      quality: 85,
      correctOrientation: true,
    });
    expect(files?.map((file) => [file.name, file.type])).toEqual([
      ["receipt-1.png", "image/png"],
      ["receipt-2.webp", "image/webp"],
    ]);
  });

  it("returns an empty list when the user cancels the library", async () => {
    (Camera.pickImages as jest.Mock).mockRejectedValue(new Error("User cancelled photos app"));
    await expect(platform.pickReceiptPhotos?.(2)).resolves.toEqual([]);
  });

  it("throws PlatformPermissionError when photo library access is denied", async () => {
    (Camera.pickImages as jest.Mock).mockRejectedValue(new Error("User denied access to photos"));
    const error = await platform.pickReceiptPhotos?.(1).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PlatformPermissionError);
    expect(error).toMatchObject({
      kind: "photos",
      message: expect.stringContaining("Settings > Receipt Splitter"),
    });
  });

  it("returns an empty list when the library selection is empty", async () => {
    (Camera.pickImages as jest.Mock).mockResolvedValue({ photos: [] });
    await expect(platform.pickReceiptPhotos?.(4)).resolves.toEqual([]);
  });

  it("shares text when the system share sheet is available", async () => {
    (Share.canShare as jest.Mock).mockResolvedValue({ value: true });
    (Share.share as jest.Mock).mockResolvedValue({ activityType: "copy" });
    await expect(platform.shareText({ title: "Split", text: "hello", url: "https://example.test" })).resolves.toBe(
      "shared",
    );
    expect(Share.share).toHaveBeenCalledWith({
      title: "Split",
      text: "hello",
      url: "https://example.test",
    });
  });

  it("returns unsupported when sharing is unavailable", async () => {
    (Share.canShare as jest.Mock).mockResolvedValue({ value: false });
    await expect(platform.shareText({ text: "hello" })).resolves.toBe("unsupported");
    expect(Share.share).not.toHaveBeenCalled();
  });

  it("returns cancelled when the share sheet is dismissed", async () => {
    (Share.canShare as jest.Mock).mockResolvedValue({ value: true });
    (Share.share as jest.Mock).mockRejectedValue(new Error("Share canceled"));
    await expect(platform.shareText({ text: "hello" })).resolves.toBe("cancelled");
  });

  it("returns unsupported when a share is already in progress", async () => {
    (Share.canShare as jest.Mock).mockResolvedValue({ value: true });
    (Share.share as jest.Mock).mockRejectedValue(new Error("Can't share while sharing is in progress"));
    await expect(platform.shareText({ text: "hello" })).resolves.toBe("unsupported");
  });

  it("copies and reads clipboard text", async () => {
    (Clipboard.write as jest.Mock).mockResolvedValue(undefined);
    (Clipboard.read as jest.Mock).mockResolvedValue({ value: "pasted", type: "text/plain" });
    await expect(platform.copyText("copied")).resolves.toBe(true);
    expect(Clipboard.write).toHaveBeenCalledWith({ string: "copied" });
    await expect(platform.readClipboardText()).resolves.toBe("pasted");
  });

  it("returns false and null when the clipboard plugin fails", async () => {
    (Clipboard.write as jest.Mock).mockRejectedValue(new Error("denied"));
    (Clipboard.read as jest.Mock).mockRejectedValue(new Error("denied"));
    await expect(platform.copyText("copied")).resolves.toBe(false);
    await expect(platform.readClipboardText()).resolves.toBeNull();
  });

  it("opens https and http links in the in-app browser", async () => {
    (Browser.open as jest.Mock).mockResolvedValue(undefined);
    await expect(platform.openExternalUrl("https://receipt-splitter.app/privacy")).resolves.toBe("opened");
    await expect(platform.openExternalUrl("http://example.test/support")).resolves.toBe("opened");
    expect(Browser.open).toHaveBeenNthCalledWith(1, { url: "https://receipt-splitter.app/privacy" });
    expect(Browser.open).toHaveBeenNthCalledWith(2, { url: "http://example.test/support" });
    expect(AppUrls.canOpenUrl).not.toHaveBeenCalled();
  });

  it("opens a custom scheme when the app can handle it", async () => {
    AppUrls.canOpenUrl.mockResolvedValue({ value: true });
    AppUrls.openUrl.mockResolvedValue({ completed: true });
    await expect(platform.openExternalUrl("venmo://paycharge?txn=pay")).resolves.toBe("opened");
    expect(AppUrls.canOpenUrl).toHaveBeenCalledWith({ url: "venmo://paycharge?txn=pay" });
    expect(AppUrls.openUrl).toHaveBeenCalledWith({ url: "venmo://paycharge?txn=pay" });
    expect(Browser.open).not.toHaveBeenCalled();
  });

  it("returns unavailable when nothing can open the custom scheme", async () => {
    AppUrls.canOpenUrl.mockResolvedValue({ value: false });
    await expect(platform.openExternalUrl("venmo://paycharge")).resolves.toBe("unavailable");
    expect(AppUrls.openUrl).not.toHaveBeenCalled();
  });

  it("returns unavailable when openUrl does not complete", async () => {
    AppUrls.canOpenUrl.mockResolvedValue({ value: true });
    AppUrls.openUrl.mockResolvedValue({ completed: false });
    await expect(platform.openExternalUrl("venmo://paycharge")).resolves.toBe("unavailable");
  });

  it("returns unavailable when opening a link throws", async () => {
    (Browser.open as jest.Mock).mockRejectedValue(new Error("no browser"));
    await expect(platform.openExternalUrl("https://receipt-splitter.app")).resolves.toBe("unavailable");
    AppUrls.canOpenUrl.mockRejectedValue(new Error("not implemented"));
    await expect(platform.openExternalUrl("venmo://paycharge")).resolves.toBe("unavailable");
  });

  it("does not treat a relative path as an external url", async () => {
    await expect(platform.openExternalUrl("/privacy")).resolves.toBe("unavailable");
    expect(Browser.open).not.toHaveBeenCalled();
    expect(AppUrls.canOpenUrl).not.toHaveBeenCalled();
  });

  it("installs itself through setPlatform", () => {
    setPlatform(platform);
    expect(getPlatform()).toBe(platform);
  });
});
