import { configureApp, getAppConfig, DEFAULT_PUBLIC_ORIGIN } from "@/lib/app-config";
import { bootNativeShell, configureMobileApp, iosAppConfig } from "@/mobile/boot";

jest.mock("./native", () => ({
  bootNative: jest.fn(),
}));

import { bootNative } from "@/mobile/native";

const bootNativeMock = bootNative as jest.MockedFunction<typeof bootNative>;

describe("mobile boot", () => {
  afterEach(() => {
    configureApp(null);
    bootNativeMock.mockReset();
  });

  it("points the iOS client at the public API when no Vite origin is set", () => {
    expect(iosAppConfig({})).toEqual({
      platform: "ios",
      apiOrigin: DEFAULT_PUBLIC_ORIGIN,
      publicOrigin: DEFAULT_PUBLIC_ORIGIN,
      appVersion: null,
    });

    configureMobileApp({
      VITE_API_ORIGIN: "https://preview.example",
      VITE_PUBLIC_ORIGIN: "https://receipt-splitter.app",
      VITE_APP_VERSION: "1.0.0",
    });
    expect(getAppConfig()).toMatchObject({
      platform: "ios",
      apiOrigin: "https://preview.example",
      publicOrigin: "https://receipt-splitter.app",
      appVersion: "1.0.0",
    });
  });

  it("swallows a native boot failure", async () => {
    bootNativeMock.mockRejectedValueOnce(new Error("plugin missing"));
    await expect(bootNativeShell()).resolves.toBeUndefined();
    expect(bootNativeMock).toHaveBeenCalledTimes(1);
  });

  it("runs bootNative when the shell loads", async () => {
    bootNativeMock.mockResolvedValueOnce(undefined);
    await bootNativeShell();
    expect(bootNativeMock).toHaveBeenCalledTimes(1);
  });
});
