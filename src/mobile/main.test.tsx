jest.mock("@/mobile/mobile.css", () => ({}));

import { Preferences } from "@capacitor/preferences";
import { createRoot } from "react-dom/client";

import { setPlatform, webPlatform } from "@/lib/platform";
import { setStorageMirror } from "@/lib/storage";

import { resetMobileRootForTests, startMobileApp } from "./main";
import { HYDRATION_TIMEOUT_MS, resetPreferencesQueueForTests } from "./native/storage";

jest.mock("react-dom/client", () => ({
  createRoot: jest.fn(() => ({ render: jest.fn() })),
}));

jest.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: jest.fn(() => ({
    getProducts: jest.fn(),
    purchase: jest.fn(),
  })),
}));

jest.mock("@capacitor/camera", () => ({
  Camera: { getPhoto: jest.fn(), pickImages: jest.fn() },
  CameraSource: { Camera: "CAMERA" },
  CameraResultType: { Uri: "uri" },
}));

jest.mock("@capacitor/share", () => ({
  Share: { canShare: jest.fn(), share: jest.fn() },
}));

jest.mock("@capacitor/clipboard", () => ({
  Clipboard: { write: jest.fn(), read: jest.fn() },
}));

jest.mock("@capacitor/browser", () => ({
  Browser: { open: jest.fn() },
}));

jest.mock("@capacitor/app", () => ({
  App: { addListener: jest.fn(async () => ({ remove: async () => {} })) },
}));

jest.mock("@capacitor/app-launcher", () => ({
  AppLauncher: { canOpenUrl: jest.fn(), openUrl: jest.fn() },
}));

jest.mock("@capacitor/status-bar", () => ({
  StatusBar: { setStyle: jest.fn(), setBackgroundColor: jest.fn() },
  Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
}));

jest.mock("@capacitor/keyboard", () => ({
  Keyboard: { setAccessoryBarVisible: jest.fn() },
}));

jest.mock("@capacitor/preferences", () => ({
  Preferences: {
    keys: jest.fn(async () => ({ keys: [] })),
    get: jest.fn(async () => ({ value: null })),
    set: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  },
}));

const env = {
  VITE_API_ORIGIN: "https://split.narula.xyz",
  VITE_PUBLIC_ORIGIN: "https://split.narula.xyz",
  VITE_APP_VERSION: "1.0.0",
};

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  resetMobileRootForTests();
  resetPreferencesQueueForTests();
  setStorageMirror(null);
  setPlatform(webPlatform);
  (createRoot as jest.Mock).mockClear();
  (Preferences.keys as jest.Mock).mockResolvedValue({ keys: [] });
  (Preferences.get as jest.Mock).mockResolvedValue({ value: null });
});

afterEach(() => {
  jest.useRealTimers();
  setPlatform(webPlatform);
  setStorageMirror(null);
});

describe("startMobileApp", () => {
  it("mounts exactly once when Preferences hangs and a late read arrives", async () => {
    jest.useFakeTimers();
    localStorage.setItem("receiptSplitterSession", "keep");
    let resolveKeys: (value: { keys: string[] }) => void = () => {};
    (Preferences.keys as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveKeys = resolve;
        }),
    );

    const starting = startMobileApp(env, true);
    await jest.advanceTimersByTimeAsync(HYDRATION_TIMEOUT_MS);
    await starting;

    expect(createRoot).toHaveBeenCalledTimes(1);

    (Preferences.get as jest.Mock).mockResolvedValue({ value: "late-native" });
    resolveKeys({ keys: ["receiptSplitterSession"] });
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("receiptSplitterSession")).toBe("keep");
  });

  it("logs a render failure instead of rejecting the boot promise", async () => {
    (createRoot as jest.Mock).mockImplementationOnce(() => {
      throw new Error("no root");
    });
    await expect(startMobileApp(env, false)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
